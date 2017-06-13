({
    dir   : 'adskiller-prod',
    appDir: '../',
    baseUrl: ".",        
    mainConfigFile : [        
        
    ],
    removeCombined : true,
    preserveLicenseComments: true,
    optimize : 'uglify2', // none,     
    modules: [
        
    ],
    onBuildWrite: function (moduleName, path, contents) {
        var rp = {
            '"debug" : true': '"debug" : false'
        };
        for(var k in rp) {
            var rege = new RegExp(k, 'g');
            contents = contents.replace(rege, rp[k]);
        }
        return contents;
    },
    fileExclusionRegExp : '\.hg|\.git|\.hgignore|build|nbproject|(^r\.js)',
    waitSeconds : 0
})
