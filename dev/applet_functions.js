const ggbScreenshot = async () => {
  // display countdown
  console.log('clicked button')
  ggbApplet.setTextValue("txtCountdown", "3");
  ggbApplet.setVisible("txtCountdown", true)
  console.log('clicked button')

  setTimeout(() => {
      ggbApplet.setTextValue("txtCountdown", "2");
  }, 1000);
  setTimeout(() => {
      ggbApplet.setTextValue("txtCountdown", "1");
  }, 2000);
  setTimeout(() => {
      ggbApplet.setVisible("txtCountdown", false)
      ggbApplet.setTextValue("txtCountdown", "3");
      for (keypoint in keypointLookup) {
          console.log(ggbApplet.evalCommand(`CopyFreeObject(${keypointLookup[keypoint]})`));
      }
  }, 3000);
}
ggbScreenshot();


let keypointNames = [];
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
let limbCommands = {
  upperLegL: 'upperLegL = Segment(hipL, kneeL)\n',
  upperLegR: 'upperLegR = Segment(hipR, kneeR)\n',
  lowerLegL: 'lowerLegL = Segment(kneeL, ankleL)\n',
  lowerLegR: 'lowerLegR = Segment(kneeR, ankleR)\n',
  upperBody: 'upperBody = Polygon(shoulderL, shoulderR, hipR, hipL, shoulderL)\n',
  upperArmL: 'upperArmL = Segment(shoulderL, elbowL)\n',
  upperArmR: 'upperArmR = Segment(shoulderR, elbowR)\n',
  lowerArmL: 'lowerArmL = Segment(elbowL, wristL)\n',
  lowerArmR: 'lowerArmR = Segment(elbowR, wristR)\n',
}

let limbNames = [
  'upperLegL',
  'upperLegR',
  'lowerLegL',
  'lowerLegR',
  'upperBody',
  'upperArmL',
  'upperArmR',
  'lowerArmL',
  'lowerArmR',
]


const createKeypointList = () => {
  let commandString = 'KeypointList = {'
  for (keypointKey in keypointLookup) {
    let keypointName = keypointLookup[keypointKey];
    console.log(`keypointName: ${keypointName}, keypointKey: ${keypointKey}`)
    commandString += `${keypointName}x, ${keypointName}y, show${keypointName},`;
  }
  commandString = commandString.slice(0, -1) + '}\n';
  console.log(commandString);
  ggbApi.evalCommand(commandString);
}
createKeypointList();

const saveCurrentPoseToSpreadsheet = () => {
  ggbApi.evalCommand('FillRow(currentRow, KeypointList)');
}
saveCurrentPoseToSpreadsheet();

const startPoseRecording = async () => {
  ggbApi.stopAnimation();
  ggbApi.evalCommand('PoseRecordingList = {}');
  ggbApi.evalCommand('currentRow = 1');
  ggbApi.evalCommand('SetCaption(btnStartRecording, "recording...")');
  ggbApi.evalCommand('SetBackgroundColor(btnStartRecording, "#CC0000")');

  isRecording = true;
  let currentRow = 1;
  let recordingTime = ggbApi.getValue('recordingLength'); // seconds
  let recordingFrameRate = measuredFrameRate; // frames / second
  let recordingFrameCount = recordingTime * recordingFrameRate; // frames
  let timeoutDuration = 1000 / recordingFrameRate; // milliseconds / frame
  ggbApi.evalCommand(`SetValue(recordingListLength,${recordingFrameCount})\n`);

  while (isRecording && currentRow < recordingFrameCount) {
    let command = (''
      + `SetValue(PoseRecordingList,${currentRow},KeypointList)\n`
      + `SetValue(currentRow, ${currentRow})\n`
    );
    ggbApi.evalCommand(command);
    currentRow += 1;
    await new Promise(r => setTimeout(r, timeoutDuration));
  }
  isRecording = false;
  ggbApi.evalCommand('SetCaption(btnStartRecording, "start recording")');
  ggbApi.evalCommand('SetBackgroundColor(btnStartRecording, "#6557D2")');
}
if (ggbApi.getCaption('btnStartRecording') !== 'recording...') {
  startPoseRecording();
}

const saveCurrentPoseToText = () => {
  let keypointListValues = ggbApi.getValueString('KeypointList').replace('KeypointList = ', '');
  let poseRecordingListCommand = ggbApi.getValueString('poseRecordingListCommand');
  if (poseRecordingListCommand.length > 30) {
    poseRecordingListCommand += ',';
  }
  poseRecordingListCommand += keypointListValues;
  ggbApi.evalCommand(`poseRecordingListCommand = "${poseRecordingListCommand}"`);
}
saveCurrentPoseToText();

const saveCurrentPoseToList = () => {
  let command = 'SetValue(PoseRecordingList,Append(PoseRecordingList,KeypointList))'
  ggbApi.evalCommand(command);
}
saveCurrentPoseToList();


let setConditionToShowBody = (postfix, condition) => {
  let commandString = '';

  for (keypointKey in keypointLookup) {
    let keypointName = keypointLookup[keypointKey];
    commandString += `SetConditionToShowObject(${keypointName}${postfix}, show${keypointName}${postfix}==true ${condition})\n`;
  }

  commandString += (''
    + `SetConditionToShowObject(upperLegL${postfix}, showhipL${postfix} && showkneeL${postfix} ${condition})\n`
    + `SetConditionToShowObject(upperLegR${postfix}, showhipR${postfix} && showkneeR${postfix} ${condition})\n`
    + `SetConditionToShowObject(lowerLegL${postfix}, showkneeL${postfix} && showankleL${postfix} ${condition})\n`
    + `SetConditionToShowObject(lowerLegR${postfix}, showkneeR${postfix} && showankleR${postfix} ${condition})\n`
    + `SetConditionToShowObject(upperArmL${postfix}, showelbowL${postfix} && showshoulderL${postfix} ${condition})\n`
    + `SetConditionToShowObject(upperArmR${postfix}, showelbowR${postfix} && showshoulderR${postfix} ${condition})\n`
    + `SetConditionToShowObject(lowerArmL${postfix}, showelbowL${postfix} && showwristL${postfix} ${condition})\n`
    + `SetConditionToShowObject(lowerArmR${postfix}, showelbowR${postfix} && showwristR${postfix} ${condition})\n`
    + `SetConditionToShowObject(upperBody${postfix}, showshoulderL${postfix} && showshoulderR${postfix} ${condition})\n`
  );
  ggbApi.evalCommand(commandString);
}
setConditionToShowBody('', ' && showLiveBody');

let setLimbColors = (postfix, color) => {
  let commandString = '';
  let limbNames = [ 
    'upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR', 
    'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 
  ]

  for (limbName of limbNames) {
    commandString += `SetColor(${limbName}${postfix}, "#${color}")\n`;
    commandString += `SetColor(upperBody${postfix}, "#80${color}")\n`;
  }

  for (keypointKey in keypointLookup) {
    let keypointName = keypointLookup[keypointKey];
    commandString += `SetColor(${keypointName}${postfix}, "#${color}")\n`
  }
  ggbApi.evalCommand(commandString);
}
setLimbColors('', 'ff9900'); // dark orange
setLimbColors('Mirror', 'ffd28e'); // light orange
setLimbColors('Recording', '0066ff'); // dark blue
setLimbColors('RecordingMirror', '8ebbff'); // light blue

let setLimbStyles = (postfix) => {
  let commandString = '';
  let limbNames = [ 
    'upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR', 
    'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 
  ]

  for (limbName of limbNames) {
    commandString += `SetLineThickness(${limbName}${postfix}, 7)\n`;
  }

  for (keypointKey in keypointLookup) {
    let keypointName = keypointLookup[keypointKey];
    if (keypointName.slice(-1) === 'R') {
      commandString += `SetPointStyle(${keypointName}${postfix}, 8)\n`; // trianlge east
    } else {
      commandString += `SetPointStyle(${keypointName}${postfix}, 9)\n`; // trianlge west
    }
  }
  ggbApi.evalCommand(commandString);
}
setLimbStyles('');
setLimbStyles('Mirror');
setLimbStyles('Recording');
setLimbStyles('RecordingMirror');


let setLimbLayer = (postfix, layerId) => {
  let commandString = '';
  let limbNames = [ 
    'upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR', 
    'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 
  ]

  for (limbName of limbNames) {
    commandString += `SetLayer(${limbName}${postfix}, ${layerId})\n`;
  }

  for (keypointKey in keypointLookup) {
    let keypointName = keypointLookup[keypointKey];
    commandString += `SetLayer(${keypointName}${postfix}, ${layerId})\n`;
  }
  commandString += `SetLayer(upperBody${postfix}, ${layerId})\n`;

  ggbApi.evalCommand(commandString);
}
setLimbLayer('', 4);
setLimbLayer('Mirror', 3);
setLimbLayer('Recording', 2);
setLimbLayer('RecordingMirror', 1);





const createLimbsCommand = (postfix, color, addConditionToShow) => {
  let commandString = '';
  commandString += (''
      + `upperLegL${postfix} = Segment(hipL${postfix}, kneeL${postfix})\n`
      + `upperLegR${postfix} = Segment(hipR${postfix}, kneeR${postfix})\n`
      + `lowerLegL${postfix} = Segment(kneeL${postfix}, ankleL${postfix})\n`
      + `lowerLegR${postfix} = Segment(kneeR${postfix}, ankleR${postfix})\n`
      + `upperBody${postfix} = Polygon(shoulderL${postfix}, shoulderR${postfix}, hipR${postfix}, hipL${postfix})\n`
      + `upperArmL${postfix} = Segment(shoulderL${postfix}, elbowL${postfix})\n`
      + `upperArmR${postfix} = Segment(shoulderR${postfix}, elbowR${postfix})\n`
      + `lowerArmL${postfix} = Segment(elbowL${postfix}, wristL${postfix})\n`
      + `lowerArmR${postfix} = Segment(elbowR${postfix}, wristR${postfix})\n`
  );

  commandString += (''
      + `SetConditionToShowObject(upperLegL${postfix}, showhipL${postfix} && showkneeL${postfix} ${addConditionToShow})\n`
      + `SetConditionToShowObject(upperLegR${postfix}, showhipR${postfix} && showkneeR${postfix} ${addConditionToShow})\n`
      + `SetConditionToShowObject(lowerLegL${postfix}, showkneeL${postfix} && showankleL${postfix} ${addConditionToShow})\n`
      + `SetConditionToShowObject(lowerLegR${postfix}, showkneeR${postfix} && showankleR${postfix} ${addConditionToShow})\n`
      + `SetConditionToShowObject(upperArmL${postfix}, showelbowL${postfix} && showshoulderL${postfix} ${addConditionToShow})\n`
      + `SetConditionToShowObject(upperArmR${postfix}, showelbowR${postfix} && showshoulderR${postfix} ${addConditionToShow})\n`
      + `SetConditionToShowObject(lowerArmL${postfix}, showelbowL${postfix} && showwristL${postfix} ${addConditionToShow})\n`
      + `SetConditionToShowObject(lowerArmR${postfix}, showelbowR${postfix} && showwristR${postfix} ${addConditionToShow})\n`
      + `SetConditionToShowObject(upperBody${postfix}, showshoulderL${postfix} && showshoulderR${postfix} ${addConditionToShow})\n`
  );

  let limbNames = [ 
    'upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR', 'upperBody', 
    'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 
  ]

  for (limbName of limbNames) {
    commandString += `SetColor(${limbName}${postfix}, "${color}")\n`;
    commandString += `ShowLabel(${limbName}${postfix}, false)\n`;
  }

  return commandString;
}

const createPoseRecordingPoints = () => {
  let commandString = '';
  let keypointIndex = 1;
  let addConditionToShow = ' && showRecording==true';
  for (keypointKey in keypointLookup) {
    // todo add limbs
    let postfix = 'Recording';
    let keypointName = keypointLookup[keypointKey];
    commandString += `${keypointName}${postfix} = Point({Element(PoseRecordingList,currentRow,${keypointIndex}), Element(PoseRecordingList,currentRow,${keypointIndex + 1})})\n`;
    commandString += `show${keypointName}${postfix} = Element(PoseRecordingList,currentRow,${keypointIndex + 2})==true\n`;
    commandString += `SetConditionToShowObject(${keypointName}${postfix}, show${keypointName}${postfix}==true ${addConditionToShow})\n`;
    commandString += `ShowLabel(${keypointName}${postfix}, false)\n`
    commandString += `SetColor(${keypointName}${postfix}, "#808080")\n`
    keypointIndex += 3;
  }
  ggbApi.evalCommand(commandString);

  const createLimbsCommandString = createLimbsCommand('Recording', '#80808080', addConditionToShow);
  ggbApi.evalCommand(createLimbsCommandString);
}
createPoseRecordingPoints();

const createPoseMirrorPoints = () => {
  let pointColor = "#CC99FF";
  let limbColor = "#80CC99FF";
  let commandString = '';
  let keypointIndex = 1;
  let postfix = 'RecordingMirror';
  let addConditionToShow = ' && mirrorRecording==true';


  for (keypointKey in keypointLookup) {
    // todo add limbs
    let keypointName = keypointLookup[keypointKey];
    commandString += `${keypointName}${postfix} = Reflect(${keypointName}Recording, mirrorAxis)\n`;
    commandString += `show${keypointName}${postfix} = show${keypointName}Recording==true\n`;
    commandString += `SetConditionToShowObject(${keypointName}${postfix}, show${keypointName}${postfix} ${addConditionToShow})\n`;
    commandString += `ShowLabel(${keypointName}${postfix}, false)\n`
    commandString += `SetColor(${keypointName}${postfix}, ${pointColor})\n`
    keypointIndex += 3;
  }
  ggbApi.evalCommand(commandString);

  const createLimbsCommandString = createLimbsCommand(postfix, limbColor, addConditionToShow);
  ggbApi.evalCommand(createLimbsCommandString);
}
createPoseMirrorPoints();



const stopPoseRecording = () => {
  // let poseRecordingListCommand = ggbApi.getValueString('poseRecordingListCommand');
  // poseRecordingListCommand += '}\n';
  // ggbApi.evalCommand(poseRecordingListCommand);

  let commandString = '';
  let keypointIndex = 1;
  for (keypointKey in keypointLookup) {
    // todo add limbs
    let keypointName = keypointLookup[keypointKey];
    commandString += `${keypointName}Recording = Point({Element(PoseRecordingList,currentRow,${keypointIndex}), Element(PoseRecordingList,currentRow,${keypointIndex + 1})})\n`;
    commandString += `SetConditionToShowObject(${keypointName}Recording, Element(PoseRecordingList,currentRow,${keypointIndex + 2})==true && showRecording==true)\n`;
    commandString += `ShowLabel(${keypointName}Recording, false)\n`
    commandString += `SetColor(${keypointName}Recording, "#80000000")\n`
    keypointIndex += 3;
  }
  // console.log(commandString);
  ggbApi.evalCommand(commandString);
}
stopPoseRecording();

const replayPoseRecording = () => {
  
}

const fillPoseRecordingList = () => {
  let poseRecordingListCommand = 'PoseRecordingList = {';
  for (poseRecordingString of poseRecordingList) {
    poseRecordingList += poseRecordingString + ',';
  }
  if (poseRecordingList.length > 0) {
    poseRecordingListCommand = poseRecordingListCommand.slice(0, -1);
  }
  poseRecordingListCommand += '}\n';
  ggbApi.evalCommand(poseRecordingListCommand);
}
fillPoseRecordingList();

const createKeypointCopies = () => {
  let commandString = '';
  let keypointIndex = 1;
  for (keypointKey in keypointLookup) {
    let keypointName = keypointLookup[keypointKey];
    commandString += `${keypointName}Recording = (Cell(currentRow,${keypointIndex}), Cell(currentRow,${keypointIndex + 1}))\n`;
    commandString += `SetConditionToShowObject(${keypointName}Recording, Cell(currentRow,${keypointIndex + 2}))\n`;
    keypointIndex += 3;
  }
  console.log(commandString);
  ggbApi.evalCommand(commandString);
}
createKeypointCopies();

const createKeypointCopiesFromList = () => {
  let commandString = '';
  let keypointIndex = 1;
  for (keypointKey in keypointLookup) {
    let keypointName = keypointLookup[keypointKey];
    commandString += `${keypointName}Recording = (Cell(currentRow,${keypointIndex}), Cell(currentRow,${keypointIndex + 1}))\n`;
    commandString += `SetConditionToShowObject(${keypointName}Recording, Cell(currentRow,${keypointIndex + 2}))\n`;
    keypointIndex += 3;
  }
  console.log(commandString);
  ggbApi.evalCommand(commandString);
}
createKeypointCopiesFromList();




let toggleReplayAnimation = () => {
  let colorPlay = '#66CC00';
  let colorStop = '#CC0000';
  let textPlay = '▶️';
  let textStop = '⏸️';

  if (ggbApi.isAnimationRunning()) {
    ggbApi.evalCommand(`SetCaption(btnPlayRecording, "${textPlay}")`);
    ggbApi.evalCommand(`SetBackgroundColor(btnPlayRecording, "${colorPlay}")`);
    ggbApi.stopAnimation();
  } else {
    ggbApi.evalCommand(`SetCaption(btnPlayRecording, "${textStop}")`);
    ggbApi.evalCommand(`SetBackgroundColor(btnPlayRecording, "${colorStop}")`);
    ggbApi.setAnimating('currentRow', true);
    ggbApi.startAnimation()
  }
}
toggleReplayAnimation();





const createBodyPartsList = () => {
}





appletParameters.appletOnLoad = (tmpApi) => {
    ggbApi = tmpApi;
    tmpApi.setRepaintingActive(false);
    tmpApi.setGridVisible(false);

    let ggbCommand = '';

    keypointNames.forEach((name, index) => {
        ggbCommand += `${keypointLookup[name]}x = 0\n`;
        ggbCommand += `${keypointLookup[name]}y = 0\n`;
        ggbCommand += `P_${index} = (${keypointLookup[name]}x, ${keypointLookup[name]}y)\n`;
        ggbCommand += `Rename(P_${index}, "${keypointLookup[name]}")\n`;
        ggbCommand += `show${keypointLookup[name]} = false\n`;
        ggbCommand += `SetConditionToShowObject(${keypointLookup[name]}, show${keypointLookup[name]})\n`;
    });

    tmpApi.evalCommand(ggbCommand);

    ggbCommand = (''
        + 'upperLegL = Segment(hipL, kneeL)\n'
        + 'upperLegR = Segment(hipR, kneeR)\n'
        + 'lowerLegL = Segment(kneeL, ankleL)\n'
        + 'lowerLegR = Segment(kneeR, ankleR)\n'
        + 'upperBody = Polygon(shoulderL, shoulderR, hipR, hipL)\n'
        + 'upperArmL = Segment(shoulderL, elbowL)\n'
        + 'upperArmR = Segment(shoulderR, elbowR)\n'
        + 'lowerArmL = Segment(elbowL, wristL)\n'
        + 'lowerArmR = Segment(elbowR, wristR)\n'
    );

    ggbCommand += (''
        + `SetConditionToShowObject(upperLegL, showhipL && showkneeL)\n`
        + `SetConditionToShowObject(upperLegR, showhipR && showkneeR)\n`
        + `SetConditionToShowObject(lowerLegL, showkneeL && showankleL)\n`
        + `SetConditionToShowObject(lowerLegR, showkneeR && showankleR)\n`
        + `SetConditionToShowObject(upperArmL, showelbowL && showshoulderL)\n`
        + `SetConditionToShowObject(upperArmR, showelbowR && showshoulderR)\n`
        + `SetConditionToShowObject(lowerArmL, showelbowL && showwristL)\n`
        + `SetConditionToShowObject(lowerArmR, showelbowR && showwristR)\n`
    );

    let cornerPoints = ['BottomLeft', 'BottomRight', 'TopLeft', 'TopRight']

    cornerPoints.forEach(cornerPoint => {
        ggbCommand += `${cornerPoint} = (0, 0)\n`;
    });

    ggbCommand += (''
        + `leftCameraLimit = Line(BottomLeft, TopLeft)\n`
        + `rightCameraLimit = Line(BottomRight, TopRight)\n`
        + `topCameraLimit = Line(TopRight, TopLeft)\n`
        + `bottomCameraLimit = Line(BottomLeft, BottomRight)\n`
    );

    tmpApi.evalCommand(ggbCommand);

    const currentPoints = tmpApi.getAllObjectNames();
    currentPoints.forEach((pointName) => {
        tmpApi.setLabelVisible(pointName, false);
        tmpApi.setAuxiliary(pointName, true);
    });
    cornerPoints.forEach((cornerPoint) => {
        tmpApi.setVisible(cornerPoint, false);
    });

    tmpApi.setRepaintingActive(true);

    registerGgbListeners();
    // const closeTabbedKeyboardButton = document.getElementsByClassName('closeTabbedKeyboardButton')[0];
    // closeTabbedKeyboardButton.addEventListener('click', () => {
    //     document.body.style.removeProperty('padding-bottom');
    // });
    isGgbReady = true;

    startVideo();
}
