import { Classes, classes, ClassIds, ClassMethodIds, classMethodsTable, ClassMethodsTable, FieldTypes, MethodFrame } from './fixtures/typed-protocol'
import { FrameType } from './constants'

export { classes, classMethodsTable, ClassIds, FieldTypes }
export * from './fixtures/typed-protocol'

export type Protocol = MethodFrame
    | ContentHeader
    | Content
    | Heartbeat

export type MethodsTableMethod = ClassMethodsTable[keyof ClassMethodsTable]
export type ClassTypes = Classes[keyof Classes]
export type ClassFields = ClassTypes['fields']
export type MethodFields = MethodsTableMethod['fields']
export type Fields = ClassFields | MethodFields
export type Field = Fields extends Array<infer T> ? T : never

export interface ContentHeaderProperties {
    [key: string]: any;

    headers: Record<string, string | number | boolean | Date | Record<string, any>>
    contentType: string;
    exchange: string;
    routingKey: string;
}

export type ContentHeader = {
    type: FrameType.HEADER;
    classInfo: ClassTypes;
    weight: number;
    size: number;
    properties: Partial<ContentHeaderProperties>;
}

export type Content = {
    type: FrameType.BODY;
    data: Buffer;
}

export type Heartbeat = {
    type: FrameType.HEARTBEAT;
}

const genAssertMap = (method: Record<string | number, any>): Record<string, true> => {
    const resp = Object.keys(method).reduce((map, id) => {
        map[id] = true
        return map
    }, {} as Record<string, true>)
    return Object.setPrototypeOf(resp, null)
}

const classMethodIds = genAssertMap(classMethodsTable)
const classIds = genAssertMap(classes)

export const isClassMethodId = (input: string): input is ClassMethodIds => {
    return classMethodIds[input] === true
}

export const isClassIndex = (input: number): input is ClassIds => {
    return classIds[input] === true
}
