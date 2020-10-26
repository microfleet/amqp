/// Publisher
import _debug = require('debug')
import { once } from 'events'
import { Reconnectable as Connection, BasicReturnError } from '@microfleet/amqp-connection'
import { Channel, CHANNEL_STATE } from './Channel'
import rfdc = require('rfdc')
import {
    methods,
    FrameType, 
    MethodNames, 
    ContentHeader, MethodFrame
} from '@microfleet/amqp-codec'

import { basicPublish } from '../defaults'

const debug = _debug('amqp:Publisher')
const clone = rfdc()

// applyDefaults = require('lodash/defaults')
// { methodTable, classes, methods } = require('./config').protocol

export const enum ConfirmState {
    Opening = 'opening',
    Open = 'open',
    Closed = 'closed'
}

type PromiseCb = <T = any>(err: Error | null, value?: T) => void

export class Publisher extends Channel {
    public confirmState: ConfirmState = ConfirmState.Closed
    private seq: number = 0
    private seqCallbacks: Map<number, PromiseCb> = new Map()
    private currentMethod: MethodFrame | null = null

    constructor(private connection: Connection, 
                public channel: number, 
                public readonly confirm: boolean = false) {
        super(connection, channel)
        if (confirm) {
            this.confirmMode()
        }
    }

    private async confirmMode(): Promise<void> {
        this.confirmState = ConfirmState.Opening
        
        await this.taskPush({ 
            type: FrameType.METHOD, 
            name: MethodNames.confirmSelect, 
            method: methods.confirmSelect, 
            args: { noWait: false },
        }, methods.confirmSelectOk)

        this.confirmState = ConfirmState.Open
        this.seq = 1
        this.emit('confirm')
    }

    private channelClosed(err: Error = new Error('Channel closed, try again')): void {
        this.confirmState = ConfirmState.Closed
        for (const cb of this.seqCallbacks.values()) {
            cb(err)
        }

        this.seqCallbacks = new Map()
        if (this.confirm) {
            this.confirmMode()
        }
    }

    public async publish(exchange: string, 
                         routingKey: string, 
                         data: unknown, 
                         opts?: Partial<Omit<ContentHeader, 'size'>>): Promise<void> {

        // Because we add modify options, we want to make sure we only modify our internal version
        // this is why we clone it.
        let options: Partial<ContentHeader> = opts ? clone(opts) : Object.create(null)

        if (this.state !== CHANNEL_STATE.Open || (this.confirm && this.confirmState !== ConfirmState.Open)) {
            if (this.state === CHANNEL_STATE.Opening || 
                this.state === CHANNEL_STATE.Closed || 
                (this.confirm && this.confirmState === ConfirmState.Opening)) {
                
                const waitFor = this.confirm ? 'confirm' : 'open'
                await once(this, waitFor)
                return this.publish(exchange, routingKey, data, opts)
            }

            throw new Error(`Channel is closed and will not re-open? ${this.state} ${this.confirm} ${this.confirmState}`)
        }

        // data must be a buffer
        if (typeof data === 'string') {
            options.contentType = 'string/utf8'
            data = Buffer.from(data, 'utf8')
        } else if (typeof data === 'object' && !Buffer.isBuffer(data)) {
            if (options.contentType) {
                throw new Error('opts.contentType specified but data isn\'t a buffer')
            }

            // TODO: use faster stringify! (fast-json-stringify?)
            data = Buffer.from(JSON.stringify(data), 'utf8')
            options.contentType = 'application/json'
        } else if (data === undefined) {
            data = Buffer.allocUnsafe(0)
            options.contentType = 'application/undefined'
        }

        // increment this as the final step before publishing, to make sure we're in sync with the server
        let thisSequenceNumber: number
        if (this.confirm) {
            thisSequenceNumber = this.seq++
        }

        // Apply default options after we deal with potentially converting the data
        options = { ...basicPublish, ...options, exchange, routingKey }

        // This is to tie back this message as failed if it failed in confirm mode with a mandatory or immediate publish
        if (this.confirm && (options.mandatory || options.immediate)) {
            options.headers ??= {}
            options.headers['x-seq'] = thisSequenceNumber
        }

        this.queuePublish methods.basicPublish, data, options

        if (this.confirm) {
            await this.waitForSeq(thisSequenceNumber)
        }
    }

    public onMethod(_: number, method: MethodFrame): void {
        this.currentMethod = method
        if (method.name === MethodNames.basicAck && this.confirm) {
            this.gotSeq(method.args.deliveryTag, method.args.multiple)
        }
    }

    public onContentHeader(_: number, header: ContentHeader): void {
        const { currentMethod } = this
        if (currentMethod?.name !== MethodNames.basicReturn) {
            return
        }

        const seq = header.properties.headers?.['x-seq']
        if (seq != null) {
            this.gotSeq(seq, false, new BasicReturnError(currentMethod.args))
        }
    }

    public onContent(_: number, __: Buffer): void {
      // Content is not needed on a basicReturn
    }

    private async waitForSeq(seq: number): Promise<void> {
        await new Promise((resolve, reject) => {
            this.seqCallbacks.set(seq, (err: Error | null) => {
                if (err) {
                    return reject(err)
                }
                resolve()
            })
        })
    }

    private gotSeq(seq: number, multi: boolean, err: Error | null = null): void {
        if (multi) {
            for (const key of this.seqCallbacks.keys()) {
                if (key <= seq) {
                    this.seqCallbacks.get(key)!(err)
                    this.seqCallbacks.delete(key)
                }
            }
        } else if (this.seqCallbacks.has(seq)) {
            this.seqCallbacks.get(seq)!(err)
            this.seqCallbacks.delete(seq)
        }
    }
}