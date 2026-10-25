window._hortor_sceneok = false;
window._hortor_sdkok = false;
window._hortor_callOnLoad = function(scene, sdkOk){
    if(scene){
        window._hortor_sceneok = scene;
    }
    
    if(sdkOk){
        window._hortor_sdkok = sdkOk;
    }
    
    if(window._hortor_sceneok && window._hortor_sdkok){
        var t_scene = window._hortor_sceneok.scene;
        if(t_scene){
            var launchChs = t_scene._children;
            if(launchChs && launchChs[0]){
                var launchComp = launchChs[0].getComponent("Launcher");

                if(launchComp){
                    launchComp.onLoadFunc();
                }
            }
        }
    }
}

function getManifest(url, options, onProgress, onComplete) {

    var xhr = new XMLHttpRequest(), errInfo = 'download failed: ' + url + ', status: ';

    xhr.open('POST', url, true);

    if (options.responseType !== undefined) xhr.responseType = options.responseType;
    if (options.withCredentials !== undefined) xhr.withCredentials = options.withCredentials;
    if (options.mimeType !== undefined && xhr.overrideMimeType) xhr.overrideMimeType(options.mimeType);
    if (options.timeout !== undefined) xhr.timeout = options.timeout;

    if (options.header) {
        for (var header in options.header) {
            xhr.setRequestHeader(header, options.header[header]);
        }
    }
    xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
            onComplete && onComplete(null, xhr.response);
        } else {
            onComplete && onComplete(new Error(errInfo + xhr.status + '(no response)'));
        }

    };

    if (onProgress) {
        xhr.onprogress = function (e) {
            if (e.lengthComputable) {
                onProgress(e.loaded, e.total);
            }
        };
    }

    xhr.onerror = function () {
        onComplete && onComplete(new Error(errInfo + xhr.status + '(error)'));
    };

    xhr.ontimeout = function () {
        onComplete && onComplete(new Error(errInfo + xhr.status + '(time out)'));
    };

    xhr.onabort = function () {
        onComplete && onComplete(new Error(errInfo + xhr.status + '(abort)'));
    };

    xhr.send(null);

    return xhr;
}

window.boot = function () {
    var settings = window._CCSettings;
    window._CCSettings = undefined;
    var onProgress = null;
    
    var RESOURCES = cc.AssetManager.BuiltinBundleName.RESOURCES;
    var INTERNAL = cc.AssetManager.BuiltinBundleName.INTERNAL;
    var MAIN = cc.AssetManager.BuiltinBundleName.MAIN;
    function setLoadingDisplay () {
        // Loading splash scene
        var splash = document.getElementById('splash');
        var progressBar = splash.querySelector('.progress-bar span');
        onProgress = function (finish, total) {
            var percent = 100 * finish / total;
            if (progressBar) {
                progressBar.style.width = percent.toFixed(2) + '%';
            }
        };
        splash.style.display = 'block';
        progressBar.style.width = '0%';

        cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {
            splash.style.display = 'none';
        });
    }

    var onStart = function () {

        cc.view.enableRetina(true);
        cc.view.resizeWithBrowserSize(true);

        if (cc.sys.isBrowser) {
            setLoadingDisplay();
        }

        if (cc.sys.isMobile) {
            if (settings.orientation === 'landscape') {
                cc.view.setOrientation(cc.macro.ORIENTATION_LANDSCAPE);
            }
            else if (settings.orientation === 'portrait') {
                cc.view.setOrientation(cc.macro.ORIENTATION_PORTRAIT);
            }
            cc.view.enableAutoFullScreen([
                cc.sys.BROWSER_TYPE_BAIDU,
                cc.sys.BROWSER_TYPE_BAIDU_APP,
                cc.sys.BROWSER_TYPE_WECHAT,
                cc.sys.BROWSER_TYPE_MOBILE_QQ,
                cc.sys.BROWSER_TYPE_MIUI,
                cc.sys.BROWSER_TYPE_HUAWEI,
                cc.sys.BROWSER_TYPE_UC,
            ].indexOf(cc.sys.browserType) < 0);
        }

        // Limit downloading max concurrent task to 2,
        // more tasks simultaneously may cause performance draw back on some android system / browsers.
        // You can adjust the number based on your own test result, you have to set it before any loading process to take effect.
        if (cc.sys.isBrowser && cc.sys.os === cc.sys.OS_ANDROID) {
            cc.assetManager.downloader.maxConcurrency = 2;
            cc.assetManager.downloader.maxRequestsPerFrame = 2;
        }

        var launchScene = settings.launchScene;
        var bundle = cc.assetManager.bundles.find(function (b) {
            return b.getSceneInfo(launchScene);
        });
        
        bundle.loadScene(launchScene, null, onProgress,
            function (err, scene) {
                if (!err) {
                    cc.director.runSceneImmediate(scene);
                    jsb && jsb.reflection.callStaticMethod("org/cocos2dx/javascript/AppActivity", "hideSplash", "()V");
                    if (cc.sys.isBrowser) {
                        // show canvas
                        var canvas = document.getElementById('GameCanvas');
                        canvas.style.visibility = '';
                        var div = document.getElementById('GameDiv');
                        if (div) {
                            div.style.backgroundImage = '';
                        }
                        console.log('Success to load scene: ' + launchScene);
                    }
                    window._hortor_callOnLoad(scene, false);
                }
            }
        );

    };

    var option = {
        id: 'GameCanvas',
        debugMode: settings.debug ? cc.debug.DebugMode.INFO : cc.debug.DebugMode.ERROR,
        showFPS: settings.debug,
        frameRate: 60,
        groupList: settings.groupList,
        collisionMatrix: settings.collisionMatrix,
    };

    var bundleRoot = [INTERNAL];
    settings.hasResourcesBundle && bundleRoot.push(RESOURCES);
    bundleRoot.push("launcher");

    var count = 0;
    function cb (err) {
        if (err) return console.error(err.message, err.stack);
        count++;
        if (count === bundleRoot.length + 1) {
            cc.assetManager.loadBundle(MAIN, function (err) {
                if (!err) cc.game.run(option, onStart);
            });
        }
    }

    cc.assetManager.loadScript(settings.jsList.map(function (x) { return 'src/' + x;}), cb);

    var download_func = null;
    var retryTotal = 60;
    var retryCount = 0;
    download_func = function(){
        getManifest(`${SERVER}/login/manifest?platform=hortor&version=${GAME_VERSION}`, {responseType: 'json', header: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
        }}, null, (err, result) => {
            if (err) {
                cc.sys.manifestResult = {
                    code: -1,
                    error: err,
                }
                console.error("mainjs error download_func", err.message);
                console.error("mainjs error retryCount is", retryCount);
                if(++retryCount < retryTotal){
                    setTimeout(download_func, 1000);
                }
            }else{
                const bundleVersStr = result && result.body && result.body.bundleVers;
                const bundleVers = JSON.parse(bundleVersStr);
                result.body.bundleVers = bundleVers;
                let manifestResult = {
                    code: 0,
                    error: null,
                    rawData: result.body
                }
                cc.sys.manifestResult = manifestResult;
                for(let bundleName in bundleVers){
                    if(bundleName === "COMMIT_ID"){
                        continue;
                    }
    
                    settings.bundleVers[bundleName] = bundleVers[bundleName];
                    if(settings.remoteBundles.indexOf(bundleName) === -1){
                        settings.remoteBundles.push(bundleName);
                    }
                }

                cc.assetManager.init({ 
                    bundleVers: settings.bundleVers,
                    remoteBundles: settings.remoteBundles,
                    server: settings.server
                });
                
                for (var i = 0; i < bundleRoot.length; i++) {
                    cc.assetManager.loadBundle(bundleRoot[i], cb);
                }
            }
        });
    }
    download_func();
};

if (window.jsb) {
    var isRuntime = (typeof loadRuntime === 'function');

    if (isRuntime) {
        require('src/settings.cbdfd.js');
        require('src/cocos2d-runtime.js');
        if (CC_PHYSICS_BUILTIN || CC_PHYSICS_CANNON) {
            require('src/physics.js');
        }
        require('jsb-adapter/engine/index.js');
    }
    else {
        require('src/settings.cbdfd.js');
        require('src/cocos2d-jsb.07adf.js');
        if (CC_PHYSICS_BUILTIN || CC_PHYSICS_CANNON) {
            require('src/physics.js');
        }
        require('jsb-adapter/jsb-engine.js');
    }

    cc.macro.CLEANUP_IMAGE_CACHE = true;
    //TODO: sdk是否可以考虑内置到模版里，不是从游戏中加载以及初始化
    //TODO: 声明统一
    {
        require("jsb-adapter/game-defines.js");
    }

    function bootstrap() {
        let start = new Date().valueOf();
        HSDK.init({
            isOpenDebug: true,
            apmPostArea: HSDK.ApmPostArea.Default,
        }).then(res => {
            console.log('初始化成功, 可以调用HSDK的其他接口了', JSON.stringify(res))
            let now = new Date().valueOf();
            console.info(
                `%c  _hsdkInit:  %c ${now - start} `,
                "color: #fadfa3; background: #030307; padding:8px 0;",
                "color: #fff; background: #ff0000; padding:8px 0;",
            );
            window._hortor_callOnLoad(null, true);
        });
    }

    window.boot();
    bootstrap();
}