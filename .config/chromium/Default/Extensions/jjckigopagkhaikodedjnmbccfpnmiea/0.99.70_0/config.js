/****
 *
 *
 *       backend main JS
 *
 **/
"use strict";

require.config({  
    baseUrl: "./",
    
    paths : {      
        
    },
    config : {
        
    },
    enforceDefine : true,
    waitSeconds: 0
});

define(['app', 'app_unittest'], function(app, debug){    
    window.debug = debug;
    window.APP = app;
    window.APP.init();
});
