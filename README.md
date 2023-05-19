![BepInEx logo](assets/logo.png)

# BepInEx.ChainedEchoes

This is a [BepInEx](https://github.com/BepInEx/BepInEx) pack for Chained Echoes, preconfigured and ready to use.

BepInEx is a general purpose framework for Unity modding. BepInEx includes tools and libraries to

-   load custom code (hereafter _plugins_) into the game on launch;
-   patch in-game methods, classes and even entire assemblies without touching original game files;
-   configure plugins and log game to desired outputs like console or file;
-   manage plugin dependencies.

BepInEx is currently [one of the most popular modding tools for Unity on GitHub](https://github.com/topics/modding?o=desc&s=stars).

## This pack's contents

This pack is preconfigured and ready to use for Chained Echoes modding.
In particular, this pack comes with:

- a preconfigured `BepInEx.cfg` that enables the BepInEx console and more extensive logging, and
- the `mscorlib.dll` assembly for Unity v2020.3.36 as the one shipped with the game has certain features removed. This enables compatibility with [Unity Explorer](https://github.com/sinai-dev/UnityExplorer)'s REPL functionality, as well as any plugin requiring access to the `System.Reflection.Emit` namespace, among others.

## Installation (automatic, Windows only)

1. Install [Vortex Mod Manager](https://www.nexusmods.com/about/vortex/) and the [Chained Echoes Support](https://www.nexusmods.com/site/mods/519) extension if you haven't already. Make sure they're fully up-to-date.
2. In Vortex, simply begin managing Chained Echoes from the Games tab, and Vortex will automatically install the BepInEx Pack for you.
3. Run the game. If everything runs correctly, you will see the BepInEx console pop up on your desktop.

## Installation (manual)

To install manually, follow these instructions:

1. Download the relevant archive:
    - For Windows, download the archive designated `x64`
    - For Linux and macOS, download the archive designated `*nix`
2. Extract the contents of the downloaded archive into the game folder:
    - On Windows, the game folder is the folder containing the game executable `Chained Echoes.exe`
    - On Linux, the game folder is the folder containing the game executable `Chained Echoes.x86_64`
    - On macOS, the game folder is the folder containing the game executable `Chained Echoes.app`
3. Depending on your operating system:
    - Windows users: Run the game. If everything runs correctly, you will see the BepInEx console pop up on your desktop.
    - Linux & macOS users: Follow the configuration instructions for your operating system below:

### Configuration (Linux)

1. Make the `run_bepinex.sh` executable with `chmod u+x run_bepinex.sh`
2. In Steam, go to the game's properties and set the launch arguments to:
    ```
    ./run_bepinex.sh %command%
    ```
    It may be necessary to replace `./run_bepinex.sh` with an absolute path to the script in your game folder.
3. Run the game via Steam

At this moment you will not see any clear indication that BepInEx is working. It is suggested to test by installing a simple plugin such as [ConfigurationManager](https://github.com/BepInEx/BepInEx.ConfigurationManager/releases) and then pressing F1 to open the Configuration Manager window.

### Configuration (macOS)

1. Make the `run_bepinex.sh` executable in Terminal with `chmod u+x run_bepinex.sh`
2. In Steam, go to the game's properties and set the launch arguments to:
    ```
    "<path to game folder>/run_bepinex.sh" %command%
    ```
    Make sure to replace `<path to game folder>` with the path to the folder where Chained Echoes is installed!
3. Run the game via Steam
4. At this point, you may see a prompt warning you that `libdoorstop_x64.dylib` cannot be opened because the developer is unverified. In this case:
   1. Open System Preferences
   2. Go to Security & Privacy and select the General tab
   3. Towards the bottom you should see a message saying that the program was blocked from opening. Click `Open Anyway` and confirm the prompt that pops up.
   4. Run the game via Steam

At this moment you will not see any clear indication that BepInEx is working. It is suggested to test by installing a simple plugin such as [Configuration Manager](https://github.com/BepInEx/BepInEx.ConfigurationManager/releases) and then pressing F1 to open the Configuration Manager window.

## Useful links

-   [BepInEx: writing basic plugin walkthrough](https://docs.bepinex.dev/articles/dev_guide/plugin_tutorial/)
-   [BepInEx: useful plugins for modding](https://docs.bepinex.dev/articles/dev_guide/dev_tools.html)
-   [BepInEx: patching game methods at runtime](https://docs.bepinex.dev/articles/dev_guide/runtime_patching.html)

## Issues, questions, etc.

At this moment, you can use the following channels to ask for help

-   [BepInEx Discord](https://discord.gg/MpFEDAg) -- **Only technical support for THIS PACKAGE. No support for plugins.**
