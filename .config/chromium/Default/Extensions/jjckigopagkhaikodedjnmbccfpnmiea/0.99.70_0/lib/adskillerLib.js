var customDb = {
    set : function(domains, callback){
        //this.getAll( this.__preset.bind(this, domains, callback) );
        chrome.storage.local.set( {'domains' : domains}, callback );
    },
    
    __preset : function( in_domains, callback, domains ){
        for(var dom in in_domains){
            domains[dom] = in_domains[dom];
        }
        chrome.storage.local.set( {'domains' : domains}, callback );
    },
    
    getAll : function( callback ){
        var clb = function( callback, data ){
            callback( (data.domains !== undefined) ? data.domains : {} );
        }
        chrome.storage.local.get( 'domains', clb.bind(this, callback) );
    }
};

var Sync = function( param ){
    this.sync_url = param.sync_url;
    this.data_url = param.data_url;
    this.title = 'sync_' + param.title || 'sync';
    this.__TIMEOUT = 45 * 1000;
    
    this.method = param.method || 'json';
    this.validateTS = param.validateTS || this.validateTS;
    this.validateData = param.validateData || this.validateData;
    this.init = param.init || this.init;
    
    if ( param.extend ){
        for(var extend in param.extend ){
            this[extend] = param.extend[extend];
        }
    }
    
    this.__init();
};

Sync.prototype = {
    
    obj : false,
    
    __init : function(){
        this.LS = mutils.customStorage( this.title );
        this.error = this.error.bind(this);
        this.init();
    },
    
    init : function(){
        this.sync(function(data){ 
            //console.log(data);
        });
    },
    
    sync : function( callback ){
       var next = this.syncedTS.bind(this, callback);
       this.__sendReq( this.sync_url, false, this.validateTS.bind(this, next), this.syncDone.bind(this, callback) );
    },
    
    
    validateTS : function(next, data){
        next( data );
    },        
    
    syncedTS : function(callback, data){
        if (data === false){
            this.syncDone( callback );
            return;
        }
        
        this.obj = {};
        
        if ( Object.prototype.toString.call(data) === "[object Object]") {
            for (var key in data) {
                this.obj[key] = data[key];
            }
        }        
        this.syncData( callback );
    },

    
    syncData : function( callback ){
        var next = this.syncedData.bind(this, callback);
        this.__sendReq( this.data_url, false, this.validateData.bind(this, next), this.syncDone.bind(this, callback) );
    },
    
    validateData : function(next, data){
        next( data );
    },
    
    syncedData : function(callback, data){
        //console.log(arguments.callee.caller);
        if (data === false){
            this.obj = false;
        } else {
            for (var key in data) {
                this.obj[key] = data[key];
            }
        }
        this.syncDone( callback );
    },

    
    syncDone : function(callback){            
        callback( this.obj );
    },

   __sendReq : function( url, data, callback, errcallback ){
        return $.ajax({
          "url" : url,
          "cache" : false,
          "data": data,
          "dataType" : this.method,
          "type" : (data && data.method) ? data.method : "GET",
          "success" : callback,
          "error"   : errcallback || this.error,
          "timeout" : this.__TIMEOUT
       });
   },          
    
   error : function(){
        console.error('sync error');
   }

};

var mutils = {        
    getDate : function (dt, notfull) {
        var ndt = new Date(dt);
        var dd  = ndt.getDate();
        var mm  = ndt.getMonth() + 1;
        var yy  = ndt.getFullYear();
        var str = (dd >= 10) ? dd : '0' + dd;
            str += '.' + ((mm >= 10) ? mm : '0' + mm);
            str += '.' + yy;
        
         if (!notfull) {
             var hh = ndt.getHours();
             var nn = ndt.getMinutes();
             var ss = ndt.getSeconds();
             str += ' ' + ((hh >= 10) ? hh : '0' + hh);
             str += ':' + ((nn >= 10) ? nn : '0' + nn);
             str += ':' + ((ss >= 10) ? ss : '0' + ss);
         }
        
        return str;
    },
        
    customDeadline : function(timeout, fn, context){
        var _fn = fn;
        
        var knock = function knock(that){
            console.log('deadline come');
            if (typeof _fn === 'function') {
                _fn.call(that);
            }
            
            _fn = null;
            that = null;
            context = null;
            timeout = null;
        }
        
        return {                
            tmr : false,
            
            start : function(){                    
                this.tmr = setTimeout(knock, timeout, context);
                return this;
            },
            stop  : function(){
                if (this.tmr) {
                    clearTimeout(this.tmr);
                }
                
                this.tmr = null;
                _fn = null;
                context = null;
                timeout = null;
            }
        }
    },
    
    customStorage : function(name, isDb){                    
        var tmp   = localStorage.getItem(name);
        var cache = (tmp === null) ? {} : JSON.parse(tmp);
        var isNew = (tmp === null) ? true : false;
        
        return {
            isNew : function(){
                return isNew;
            },

            get : function(param){
                 return (cache[param] === undefined) ? undefined : cache[param];
            },
            
            set : function(param, value){
                
                cache[param] = value;
                localStorage.setItem(name, JSON.stringify(cache));
            },
            unset : function(param){
                delete(cache[param]);
                localStorage.setItem(name, JSON.stringify(cache));
            }
        }
    },
    
    customDebug : function(level, debugState){
        var debug = (debugState !== undefined) ? debugState : true;
        debug = (conf.config().debug === false) ? false : debug;
        
        return function(log_, logType, iTime){
            if (!debug) return;
            
            var act;
            
            logType = (logType === undefined) ? 'log' : logType;
            iTime = (iTime === undefined) ? true : false;
            
            switch (logType) {
                    case 'log' :
                        act = 'log'; //show clear log
                        break;
                        
                    case 'warning' :
                        act = 'warn'; //show clear log
                        break;
                        
                    case 'info' :    
                        act = 'info'; //show clear log
                        break;
                        
                    case 'error' :    
                        act = 'error'; //show clear log
                        break;
                        
                    default :
                        act = 'log';
                        break;
                }
            
            if (iTime === true) {
                log_ = [].concat(log_);
                log_ = (log_)  ? log_ : '[=)]';             
            } else {
                console[act](log_);
                return;
            }
            
            var td = new Date(),
            nrt = td.getHours()+':'+td.getMinutes()+':'+td.getSeconds();
            
            console[act](nrt, " => ", '[' + level + '] ', log_) 
        }
    },
    
    quefn : function(arr, fn, gCallback, cont){
        var _clone = [].concat(arr);
        
        var workDone = function(){
            if (typeof gCallback === "function") {
                cont = (cont) ? cont : this;
                gCallback.call(cont);
                arr = null;
                fn = null;
            }
        }
        
        var work = function(){           
            if (_clone.length === 0) {
                workDone();
                return;
            }
            if (typeof fn === "function") {
                cont = (cont) ? cont : this;
                fn.call(cont, _clone.shift(), work);
            }           
        }
        
        return {
            "work" : function(){
               work(); 
            }
        };
    }   
    
};

window.APP = {
    "debug" : true,
    "__MIN_TIMEREQ" : 60,//in minutes
    "auth_id"  : "hdpfeicgddgckmimbaednkieaehgccec"         
};

var adskiller_block = new Sync({
    sync_url : 'http://update.adskiller.me/adblock/ts.md5',
    data_url: 'http://update.adskiller.me/adblock/ts.php',
    title : 'sidder',
    
    validateTS : function( next, data ){
        if (!data || !data.ts) {
            next( false );
        }
        
        if (!window.APP.debug && data.ts ===  this.LS.get('ts')) {
            next( false );
            return;
        };
        
        this.ts = data.ts;
        this.next = ~~data.next;
        
        next( data );
    },
    
    validateData : function( next, data ){
        //console.log(data);
        var tmp = {};
        var obj = {};
        
        if (!data || !data.result){
            return false;
        }
        
        var arr = data.domains;
        
        for(var i = 0, cnt = arr.length; i < cnt; i += 1){
            if (arr[i].length === 0) continue;
            tmp[ arr[i].domain ] = arr[i];
        }            
        
        obj = {
            "next" : (this.next > window.APP.__MIN_TIMEREQ) ? this.next : window.APP.__MIN_TIMEREQ,
            "ts"   : this.ts
        }
        this.LS.set('ts', this.ts);
        customDb.set( tmp, next.bind(this, obj) );
        /*customDb.getAll(function(domains) {
            console.log(domains);
        });*/
    }
    
}); 