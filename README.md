# npm-pkg-top

Lists the top packages by npm stars, github stars, and depended upon

```
$ bin/npm-pkg-top --help
npm-pkg-top [top] [options]

Options:
  --type, -t      Type of packages to list top               [default: "binary"]
  --sort-by, -b   Key to sort packages by [npm, dep, git]    [default: "dep"]
  --skip          Skips adding properties [git, dep]       
  --username, -u  Optional Github username to use          
  --password, -p  Optional Github password to use          
  --load, -l      Loads existing output from --save to view
  --save, -s      Save JSON output to this file            
  --load-query    Loads existing raw npm query JSON        
  --save-query    Save raw npm query JSON to this file     
  --silent, -s    Suppress log output                      
  --help, -h      Displays this message
```

## Top 20 binary modules

_Sorted by Number of Dependents_
```
$ bin/npm-pkg-top
(...)
data:    #  npm git  dep pkg         
data:    1  8   773  185 ws          
data:    2  5   -    172 hiredis     
data:    3  8   1052 119 pg          
data:    4  7   1336 112 canvas      
data:    5  11  717  83  bcrypt      
data:    6  1   595  72  websocket   
data:    7  5   450  70  sqlite3     
data:    8  1   71   67  phantomjs   
data:    9  1   802  63  serialport  
data:    10 4   325  59  libxmljs    
data:    11 2   1017 58  fibers      
data:    12 2   234  56  iconv       
data:    13 2   -    48  node-expat  
data:    14 3   669  42  zmq         
data:    15 5   70   38  leveldown   
data:    16 1   127  38  microtime   
data:    17 1   407  37  node-sass   
data:    18 4   759  36  node-xmpp   
data:    19 2   98   36  buffertools 
data:    20 0   57   30  ref         
```
_Dated: September 26, 2013_

#### Copyright 2013, Nodejitsu Inc.
#### License: MIT