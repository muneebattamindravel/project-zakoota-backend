// Paste your KNOWN_APP_NAMES list here (unchanged) ↓
const RAW_MAPPINGS = [
  /* DCC / 3D & Texturing */
  ['3dsmax', 'Autodesk 3ds Max'],
  ['maya', 'Autodesk Maya'],
  ['houdini', 'SideFX Houdini'],
  ['blender', 'Blender'],
  ['zbrush', 'ZBrush'],
  ['mudbox', 'Autodesk Mudbox'],
  ['marmoset', 'Marmoset Toolbag'],
  ['rizomuv', 'RizomUV'],
  ['xnormal', 'xNormal'],
  ['adobe substance 3d painter','Adobe Substance 3D Painter'],
  ['substance 3d painter','Adobe Substance 3D Painter'],
  ['substance painter','Adobe Substance 3D Painter'],
  ['adobe substance 3d designer','Adobe Substance 3D Designer'],
  ['substance 3d designer','Adobe Substance 3D Designer'],
  ['substance designer','Adobe Substance 3D Designer'],
  ['adobe substance 3d sampler','Adobe Substance 3D Sampler'],
  ['substance 3d sampler','Adobe Substance 3D Sampler'],
  ['substance sampler','Adobe Substance 3D Sampler'],
  ['adobe substance 3d modeler','Adobe Substance 3D Modeler'],
  ['substance 3d modeler','Adobe Substance 3D Modeler'],
  ['adobe substance 3d stager','Adobe Substance 3D Stager'],
  ['substance 3d stager','Adobe Substance 3D Stager'],
  ['quixel mixer','Quixel Mixer'],
  ['quixel bridge','Quixel Bridge'],
  ['quixel','Quixel Bridge'],
  ['adobe bridge','Adobe Bridge'],
  /* Adobe Creative */
  ['photoshop','Adobe Photoshop'],
  ['illustrator','Adobe Illustrator'],
  ['afterfx','Adobe After Effects'],
  ['after effects','Adobe After Effects'],
  ['premiere','Adobe Premiere Pro'],
  ['media encoder','Adobe Media Encoder'],
  ['audition','Adobe Audition'],
  ['lightroom','Adobe Lightroom Classic'],
  /* Game Engines */
  ['unity hub','Unity Hub'],
  ['unityhub','Unity Hub'],
  ['unity editor','Unity Editor'],
  ['unity','Unity Editor'],
  ['ue5editor','Unreal Editor'],
  ['ue4editor','Unreal Editor'],
  ['unrealeditor','Unreal Editor'],
  ['unreal','Unreal Editor'],
  ['epicgameslauncher','Epic Games Launcher'],
  ['epic games launcher','Epic Games Launcher'],
  ['godot','Godot Engine'],
  ['gamemaker','GameMaker'],
  ['cryengine','CRYENGINE Sandbox'],
  ['construct3','Construct 3'],
  ['construct 3','Construct 3'],
  ['construct2','Construct 2'],
  ['construct','Construct'],
  /* VR / Quest / Profilers */
  ['meta quest developer hub','Meta Quest Developer Hub'],
  ['oculus developer hub','Meta Quest Developer Hub'],
  ['oculusdev','Meta Quest Developer Hub'],
  ['oculusclient','Meta Quest App'],
  ['oculus client','Meta Quest App'],
  ['oculusdash','Oculus Dash'],
  ['ovrserver','Oculus VR Runtime'],
  ['oculusdebugtool','Oculus Debug Tool'],
  ['oculus mirror','Oculus Mirror'],
  ['oculusmirror','Oculus Mirror'],
  ['sidequest','SideQuest'],
  ['steamvr','SteamVR'],
  ['adb','Android Debug Bridge'],
  ['scrcpy','scrcpy'],
  ['renderdoc','RenderDoc'],
  ['nsight','NVIDIA Nsight'],
  ['vtune','Intel VTune Profiler'],
  /* IDEs & Editors */
  ['devenv','Microsoft Visual Studio'],
  ['msbuild','MSBuild'],
  ['rider64','JetBrains Rider'],
  ['rider','JetBrains Rider'],
  ['clion','CLion'],
  ['pycharm','PyCharm'],
  ['webstorm','WebStorm'],
  ['idea64','IntelliJ IDEA'],
  ['android studio','Android Studio'],
  ['qtcreator','Qt Creator'],
  ['sublime_text','Sublime Text'],
  ['notepad++','Notepad++'],
  ['notepad','Notepad'],
  ['code','Visual Studio Code'],
  /* Version Control / Dev Tools */
  ['p4v','Perforce P4V'],
  ['p4merge','P4Merge'],
  ['p4admin','Perforce P4Admin'],
  ['helix','Perforce Helix Core'],
  ['githubdesktop','GitHub Desktop'],
  ['gitkraken','GitKraken'],
  ['sourcetree','Sourcetree'],
  ['tortoisegitproc','TortoiseGit'],
  ['tortoisesvn','TortoiseSVN'],
  ['plastic','Plastic SCM'],
  ['cmder','Cmder'],
  ['postman','Postman'],
  ['insomnia','Insomnia'],
  ['docker desktop','Docker Desktop'],
  ['cmake-gui','CMake (GUI)'],
  ['cmake','CMake'],
  /* Audio / Middleware */
  ['fmod','FMOD Studio'],
  ['wwise','Wwise'],
  ['reaper','REAPER'],
  ['ableton live','Ableton Live'],
  ['audacity','Audacity'],
  ['adobe audition','Adobe Audition'],
  ['pro tools','Pro Tools'],
  /* Communication / PM */
  ['slack','Slack'],
  ['discord','Discord'],
  ['teams','Microsoft Teams'],
  ['zoom','Zoom'],
  ['notion','Notion'],
  ['trello','Trello'],
  ['clickup','ClickUp'],
  ['confluence','Confluence'],
  ['jira','Jira'],
  /* Browsers */
  ['chrome','Google Chrome'],
  ['msedge','Microsoft Edge'],
  ['edge','Microsoft Edge'],
  ['firefox','Mozilla Firefox'],
  ['opera','Opera'],
  ['brave','Brave'],
  ['vivaldi','Vivaldi'],
  /* Capture / Utilities */
  ['obs64','OBS Studio'],
  ['obs','OBS Studio'],
  ['sharex','ShareX'],
  ['greenshot','Greenshot'],
  ['snagit','Snagit'],
  ['7zfm','7-Zip'],
  ['winrar','WinRAR'],
  ['everything','Everything'],
  ['bcompare','Beyond Compare'],
  ['winmergeu','WinMerge'],
  ['filezilla','FileZilla'],
  ['teracopy','TeraCopy'],
  ['nvcplui','NVIDIA Control Panel'],
  ['nvidia broadcast','NVIDIA Broadcast'],
  ['geforce experience','NVIDIA GeForce Experience'],
  ['explorer','File Explorer'],
  ['powershell','Windows PowerShell'],
  ['cmd','Command Prompt'],
  ['putty','PuTTY'],
  ['inkscape','Inkscape'],
  ['krita','Krita'],
  ['gimp','GIMP'],
  ['affinity photo','Affinity Photo'],
  ['affinity designer','Affinity Designer']
];

function norm(s='') {
  return s.toLowerCase().replace(/\.(exe|app)$/,'').replace(/\s+/g,' ').trim();
}

const MAP = RAW_MAPPINGS.map(([k, v]) => [norm(k), v]);

function guessAppName({ processName = '', title = '' }) {
  const p = norm(processName);
  for (const [k, label] of MAP) {
    if (p.includes(k)) return label;
  }
  const t = norm(title);
  for (const [k, label] of MAP) {
    if (t.includes(k)) return label;
  }

  // Some heuristic fallbacks
  if (/chrome/i.test(title)) return 'Google Chrome';
  if (/unreal/i.test(title)) return 'Unreal Editor';
  if (/unity/i.test(title))  return 'Unity Editor';

  // Final fallback: prettify process name
  if (processName) {
    return processName
      .replace(/\.(exe|app)$/i,'')
      .replace(/[_\-]+/g,' ')
      .replace(/\b\w/g, m => m.toUpperCase());
  }
  return 'Unknown';
}

module.exports = { guessAppName };
