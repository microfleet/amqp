#!/bin/sh

set -e

# default to all the tests
GREP=""

# don't run coverage by default
COVERAGE=false

# disable nodejs debugging by default
NODE_DEBUG=false

ROOT=`git rev-parse --show-toplevel`
# the default directory to test from
FILES=$ROOT/test

# try to find mocha, no matter where it is
PATTERN="*.test.coffee"

USAGE='Usage: '$0' [options] [paths]\n\n'
USAGE=$USAGE'Options:\n'
USAGE=$USAGE'	-g	only run the tests whose names match this grep pattern\n'
USAGE=$USAGE'	-d	enable the nodejs debugger\n'
USAGE=$USAGE'	-p	only run the tests whole _files_ match this pattern\n'
USAGE=$USAGE'	-h	display this help information\n'
USAGE=$USAGE'	-c	display coverage output instead of pass/fail\n\n'
USAGE=$USAGE'Example:\n'
USAGE=$USAGE'# run only the sync.test.coffee test\n'
USAGE=$USAGE'	'$0' test/unit/sync.test.coffee\n\n'
USAGE=$USAGE'# run only the unit tests matching hello \n'
USAGE=$USAGE'	'$0' -g hello test/unit\n\n'

args=`getopt g:p:cdh $*`
# this is used if getopt finds an invalid option
if test $? != 0
then
  echo $USAGE
  exit 1
fi

set -- $args

while [ ! -z "$1" ]
do
  case "$1" in
    -c)
      COVERAGE=true
      ;;
    -d)
      NODE_DEBUG=true
      ;;
    -g)
      GREP=$2
      # shift another parameter off of grep, since it requires 2
      shift
      ;;
    -p)
      PATTERN=$2
      # shift another parameter off, since pattern requires an argument
      shift
      ;;
    -h)
      echo $USAGE
      exit 1
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Invalid option $1"
      echo $USAGE
      exit 1
      ;;
  esac

  shift
done

if [ "$#" -ne 0 ];then
  FILES=$@
fi

cd $ROOT/test/ssl/
./cleanSsl.sh
./setupSsl.sh
cd $ROOT

$ROOT/scripts/compile.sh

mdep test run
