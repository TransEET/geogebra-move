const GGBDANCE_VERSION = '0.3'

const legacyKeypointLookup = {
    "left_eye": "eye_{left}",
    "right_eye": "eye_{right}",
    "left_shoulder": "shoulder_{left}",
    "right_shoulder": "shoulder_{right}",
    "left_elbow": "elbow_{left}",
    "right_elbow": "elbow_{right}",
    "left_wrist": "wrist_{left}",
    "right_wrist": "wrist_{right}",
    "left_hip": "hip_{left}",
    "right_hip": "hip_{right}",
    "left_knee": "knee_{left}",
    "right_knee": "knee_{right}",
    "left_ankle": "ankle_{left}",
    "right_ankle": "ankle_{right}",
}

let keypointLookup = {
    "left_eye": "eyeL",
    "right_eye": "eyeR",
    "left_shoulder": "shoulderL",
    "right_shoulder": "shoulderR",
    "left_elbow": "elbowL",
    "right_elbow": "elbowR",
    "left_wrist": "wristL",
    "right_wrist": "wristR",
    "left_hip": "hipL",
    "right_hip": "hipR",
    "left_knee": "kneeL",
    "right_knee": "kneeR",
    "left_ankle": "ankleL",
    "right_ankle": "ankleR",
}

const setKeypoints = (keypointLookupDict) => {
    keypointLookup = keypointLookupDict;
    Object.keys(keypointLookup).forEach((limbName) => {
        keypointChanged[limbName] = {
            x: 0,
            y: 0,
            isDetected: false,
        };
    });
    keypointNames = Object.keys(keypointLookup)
}

let currentGgbVersion = GGBDANCE_VERSION;
let keypointChanged = {};
let keypointNames = [];
setKeypoints(keypointLookup);

let isDetectorReady = false;
let isDetectorActive = false;
let detector = null;
let isGgbReady = false;
let ggbApi = null;
let ggbAppletContainer = document.getElementById('applet_container');
let isCameraReady = false;
let webcamVideo = null;

let lastFrameTime = 0;
let frameRate = 24;
let measuredFrameRate = 24;
let msWaitPerFrame = 30;
let detectionThreshold = 0.7;

let videoWidth = 300;
let videoHeight = 300;
let ggbLimitTop = 300;
let ggbLimitRight = 300;
let cameraGap = 20;

let ggbWidth = 0;
let ggbHeight = 0;
let ggbScaleX = 1;
let ggbScaleY = 1;
let ggbGapX = 0;
let ggbGapY = 0;

let resizeTimeout = null;


const decideUpdatePoses = async (now) => {
    let diffFrameTime = now - lastFrameTime;
    if (diffFrameTime > msWaitPerFrame) {
        await updatePoses();
        lastFrameTime = now;
        measuredFrameRate = Math.trunc((measuredFrameRate + ( 1000. / diffFrameTime )) / 2);
    }
    if (isDetectorActive) {
        window.requestAnimationFrame(decideUpdatePoses);
    }
}

const updatePoses = async () => {
    const poses = await detector.estimatePoses(webcamVideo);

    if(poses && poses[0]?.keypoints) {
        ggbApi.setRepaintingActive(false);
        poses[0].keypoints.forEach((item) => {
            if (keypointNames.includes(item.name)) {
                if (item.score > detectionThreshold) {
                    y = ((ggbLimitTop - (item.y * ggbScaleY)) + keypointChanged[item.name].y) / 2.;
                    // y = (keypointChanged[item.name].y + y) / 2.;
                    x = ((ggbLimitRight - (item.x * ggbScaleX)) + keypointChanged[item.name].x) / 2.;
                    // x = (keypointChanged[item.name].x + x) / 2.;
                    ggbApi.setValue(keypointLookup[item.name] + 'x', x);
                    ggbApi.setValue(keypointLookup[item.name] + 'y', y);
                    if (keypointChanged[item.name].isDetected) {
                        ggbApi.evalCommand(`show${keypointLookup[item.name]} = true\n`);
                    };
                    keypointChanged[item.name] = {
                        isDetected: true,
                        x: x,
                        y: y,
                    };
                } else {
                    if (!keypointChanged[item.name].isDetected) {
                        ggbApi.evalCommand(`show${keypointLookup[item.name]} = false\n`);
                    };
                    keypointChanged[item.name].isDetected = false;
                }
            }     
        });
        ggbApi.setRepaintingActive(true);
    } else {
        keypointNames.forEach((keypointName) => {
            ggbApi.evalCommand(`show${keypointLookup[keypointName]} = false\n`);
            keypointChanged[keypointName].isDetected = false;
        });
    }
};


const updateGgbViewParameters = () => {
    let ggbViewProps = JSON.parse(ggbApi.getViewProperties(1));

    let webcamRatio = videoWidth / videoHeight;
    if (webcamVideo) {
        webcamVideo.width / webcamVideo.height;
    }

    let ggbRatio = ggbViewProps.width / ggbViewProps.height;

    ggbHeight = ggbViewProps.height * ggbViewProps.invYscale;
    ggbWidth = ggbViewProps.width * ggbViewProps.invXscale;
    ggbScaleY = ggbHeight / videoHeight;
    ggbScaleX = ggbWidth / videoWidth;
    ggbLimitTop = ggbHeight + ggbViewProps.yMin;
    ggbLimitRight = ggbWidth + ggbViewProps.xMin;


    if (webcamRatio < ggbRatio) {
        ggbScaleX = ggbScaleY;
        ggbGapX = (ggbWidth - (ggbHeight * webcamRatio)) / 2.0;
        ggbLimitRight -= ggbGapX;
        ggbGapY = 0.0;
    } else {
        ggbScaleY = ggbScaleX;
        ggbGapY = (ggbHeight - (ggbWidth / webcamRatio)) / 2.0;
        ggbLimitTop -= ggbGapY;
        ggbGapX = 0.0;
    }

    let ggbCommand = (''
        + `leftCameraLimit = ${ggbViewProps.xMin + ggbGapX}\n`
        + `rightCameraLimit = ${ggbLimitRight}\n`
        + `topCameraLimit = ${ggbLimitTop}\n`
        + `bottomCameraLimit = ${ggbViewProps.yMin + ggbGapY}\n`
    );
    ggbApi.evalCommand(ggbCommand);
}

function onViewChanged(args) {
    if (args.type === 'viewChanged2D' && args?.viewNo === 1) {
        updateGgbViewParameters();
    }
};

const registerGgbListeners = () => {
    ggbApi.registerClientListener('onViewChanged');
};

const unregisterGgbListeners = () => {
    ggbApi.unregisterClientListener('onViewChanged');
};

const toggleShowLoader = (isLoading) => {
    if (isLoading) {
        let loaderElement = document.createElement('div');
        loaderElement.id = 'loader-container';
        loaderElement.innerHTML = '<div class="loader">';
        document.body.appendChild(loaderElement);
    } else {
        let loaderElement = document.getElementById('loader-container');
        document.body.removeChild(loaderElement);
    }
};

const onClickSave = async () => {
    let fileName = document.getElementById('input-file-name').value.trim();

    if (fileName === '') {
        fileName = 'ggb_dance_construction.json';
    } else if (fileName.length > 4 && fileName.slice(-5) !== '.json') {
        fileName += '.json';
    }

    unregisterGgbListeners();
    const ggbState = ggbApi.getBase64();
    let fileContent = {
        ggbdanceVersion: currentGgbVersion,
        interactions: [],
        ggbState: ggbState,
        ggbObjectNames: [],
        ggbSliderNames: [],
    }

    var dataString = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fileContent));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataString);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    registerGgbListeners();
};

let saveButton = document.getElementById('save-button');
saveButton.addEventListener('click', onClickSave);

const onChangeFileName = (event) => {
    console.log(event);
    if (event.key === 'Enter') {
        onClickSave();
    }
};

let fileNameTextBox = document.getElementById('input-file-name');
fileNameTextBox.addEventListener('keypress', onChangeFileName);


const loadAppletFromJson = async (jsonContent) => {
    if ('ggbState' in jsonContent) {
        let motionTrackingButton = document.getElementById('tracking-button');
        let wasDetectorActive = isDetectorActive;

        if (isDetectorActive) {
            motionTrackingButton.click();
        }
        motionTrackingButton.disabled = true;

        console.log('loading GeoGebra construction');
        ggbApi.setBase64(jsonContent.ggbState); 

        let hasAppletLoaded = false;
        let currentGGBObjectNames = []
        while (!hasAppletLoaded) {
            currentGGBObjectNames = ggbApi.getAllObjectNames();
            if (currentGGBObjectNames.length > 10) {
                hasAppletLoaded = true;
            } else {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        if (!('ggbdanceVersion' in jsonContent)) {
            console.log('no ggbdance version in file');
            let isVersion01 = true;
            
            for (legacyName of ['wrist_{left}x', 'wrist_{right}x']) {
                isVersion01 = ggbApi.exists(legacyName);
                console.log(`is ${legacyName} in file? ${isVersion01}`);
                if (!isVersion01) { break; };
            }
            if (isVersion01) {
                console.log('loading legacy file v0.1');
                currentGgbVersion = '0.1';
                setKeypoints(legacyKeypointLookup);
            } else {
                let isVersion02 = true;
                for (legacyName of ['handLx', 'handRx', 'handLy', 'handRy']) {
                    isVersion02 = ggbApi.exists(legacyName);
                    console.log(`is ${legacyName} in file? ${isVersion02}`);
                    if (!isVersion02) { break; };
                } 
                if (isVersion02) {
                    currentGgbVersion = '0.2';
                    console.log('loading legacy file v0.2');
                    keypointLookup['left_wrist'] = 'handL';
                    keypointLookup['right_wrist'] = 'handR';
                    setKeypoints(keypointLookup);
                }
            }
        } else if (jsonContent['ggbdanceVersion'] === '0.1') {
            console.log('loading legacy file v0.1');
            currentGgbVersion = '0.1';
            setKeypoints(legacyKeypointLookup);
        } else if (jsonContent['ggbdanceVersion'] === '0.2') {
            currentGgbVersion = '0.2';
            console.log('loading legacy file v0.2');
            keypointLookup['left_wrist'] = 'handL';
            keypointLookup['right_wrist'] = 'handR';
            setKeypoints(keypointLookup);
        }

        motionTrackingButton.disabled = false;
        if (wasDetectorActive) {
            motionTrackingButton.click();
        }
    } else {
        window.alert(
            'There seems to be something wrong with the file you chose.\n' +
            'Make sure to choose a file that was created by this Website.'
        );
    }
    toggleShowLoader(false);
};

const onClickLoad = async () => {
    const filePickerNode = document.getElementById('file-to-load');
    if (filePickerNode.files.length === 1) {
        toggleShowLoader(true);
        let reader = new FileReader();
        reader.onload = async (event) => {
            const fileContent = JSON.parse(event.target.result);
            loadAppletFromJson(fileContent);
            let fileNameElement = document.getElementById('input-file-name');
            fileNameElement.value = filePickerNode.files[0].name;
        }
        reader.readAsText(filePickerNode.files[0]);
    } else {
        window.alert('Please choose a file to upload before clicking the load button.');
    }
};

document.getElementById('file-to-load').addEventListener('change', onClickLoad);

/////////////////////////////////

const startVideo = async () => {
    var constraints = {
        audio: false,
        video: { 
            width: { ideal: 640 }, 
            aspectRatio: { ideal: 1.7777777778 },
            frameRate: { ideal: frameRate },
        },
    };
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoSettings = stream.getTracks()[0].getSettings();
        videoWidth = videoSettings.width;
        videoHeight = videoSettings.height;

        if (videoSettings.frameRate < frameRate) {
            frameRate = videoSettings.frameRate;
        }
        msWaitPerFrame = ~~(1000 / frameRate);

        ggbApi.evalCommand('SetAxesRatio(1,1)');

        updateGgbViewParameters();

        console.log('camera access granted.');
        webcamVideo = document.getElementById('video');
        webcamVideo.srcObject = stream;
        webcamVideo.width = videoWidth;
        webcamVideo.height = videoHeight;

        webcamVideo.addEventListener('loadeddata', startPoseDetection);
        
    } catch (error) {
        window.alert(
            'This app cannot use your camera.\n' +
            'It might be in use by a different program.\n' +
            'Make sure to disable your camera in all other applications to enable body tracking.'
        );
        console.log(error);
    } 
}

const startPoseDetection = async () => {
    // const detectorConfig = {modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING};
    // const detectorConfig = {modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER};
    // model = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
    // detector = model;

    const model = poseDetection.SupportedModels.BlazePose;
    const detectorConfig = {
        runtime: 'mediapipe',
        enableSmoothing: true,
        smoothSegmentation: true,
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
        modelType: 'full',
    };

    detector = await poseDetection.createDetector(model, detectorConfig);

    console.log('pose detector is ready.');
    isDetectorReady = true;

    document.getElementById('tracking-button').removeAttribute('disabled');
    loadAppletFromUrlParameter();
};

const loadAppletFromUrlParameter = async () => {
    let params = new URLSearchParams(document.location.search);
    let appletName = params.get('applet');
    if ( !appletName ) {
        appletName = 'ggb_dance_construction';
    }
    const url = `applets/${appletName}.json`;
    toggleShowLoader(true);
    fetch(url)
        .then( (response) => {
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }
            response.json().then( (json) => {
                loadAppletFromJson(json);
                let fileNameElement = document.getElementById('input-file-name');
                fileNameElement.value = `${appletName}.json`;
            });
        })
        .catch( (error) => {
            console.error(error.message);
            toggleShowLoader(false);

        });
};

const onPauseDetection = () => {
    isDetectorActive = false;
}

const onStartDetection = () => {
    if (isDetectorReady) {
        isDetectorActive = true;
        decideUpdatePoses(0);
    }
}

const onClickTracking = (event) => {
    let trackingButton = event.target;
    if (isDetectorActive) {
        // stop tracking
        onPauseDetection();
        trackingButton.value = 'Start body tracking';
        trackingButton.classList.remove('pause-button');
    } else {
        // start tracking
        onStartDetection();
        trackingButton.value = 'Pause body tracking';
        trackingButton.classList.add('pause-button');
    }
};

document.getElementById('tracking-button').addEventListener('click', onClickTracking);

startGgbApplet = () => {

    var appletParameters = {
        "id": "ggbApplet",
        "appName": "classic",
        "prerelease":false,
        "width": window.innerWidth - 20,
        "height": window.innerHeight - 60,
        "showToolBar":true,
        "borderColor":null,
        "showMenuBar":true,
        "perspective":"G",
        "algebraInputPosition":"bottom",
        "showAlgebraInput":true,
        "showResetIcon":false,
        "enableLabelDrags":true,
        "enableShiftDragZoom":true,
        "enableRightClick":true,
        "capturingThreshold":null,
        "showToolBarHelp":true,
        "errorDialogsActive":true,
        "useBrowserForJS":false,
        "disableAutoScale":true,
    };

    appletParameters.appletOnLoad = (tmpApi) => {
        ggbApi = tmpApi;
        tmpApi.setGridVisible(false);

        registerGgbListeners();
        // const closeTabbedKeyboardButton = document.getElementsByClassName('closeTabbedKeyboardButton')[0];
        // closeTabbedKeyboardButton.addEventListener('click', () => {
        //     document.body.style.removeProperty('padding-bottom');
        // });
        isGgbReady = true;

        startVideo();
    }
    
    ggbApplet = new GGBApplet(appletParameters, '5.0', 'applet_container');
    ggbApplet.setHTML5Codebase('./GeoGebra/HTML5/5.0/web3d/');
    
    window.onload = async function() {
        ggbApplet.inject('applet_container');
    }
}

window.addEventListener('resize', (event) => {
    clearTimeout(resizeTimeout);
    
    if (isGgbReady) {
        resizeTimeout = setTimeout(() => {
            let newWidth = window.innerWidth - 20;
            let newHeight = window.innerHeight - 60;
            ggbApi.setSize(newWidth, newHeight);
            ggbAppletContainer.style.width = `${newWidth}px`;
            ggbAppletContainer.style.height = `${newHeight}px`;
            document.getElementsByClassName('applet_scaler')[0].style.width = `${newWidth}px`;
            document.getElementsByClassName('applet_scaler')[0].style.height = `${newHeight}px`;
        }, 100);
    }
});

startGgbApplet();
