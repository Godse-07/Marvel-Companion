import * as vscode from "vscode";
import { randomBytes } from "crypto";

type CharacterId = "spiderman" | "ironman" | "thor" | "blackpanther";

interface Character {
  id: CharacterId;
  label: string;
  filename: string;
  imageWidth: number;
  showWeb?: boolean;
}

const CHARACTERS: Character[] = [
  {
    id: "spiderman",
    label: "$(symbol-misc) Spider-Man",
    filename: "spiderman.png",
    imageWidth: 180,
    showWeb: true, // only Spider-Man gets the web thread
  },
  {
    id: "ironman",
    label: "$(zap) Iron Man",
    filename: "Ironman.png",
    imageWidth: 140,
  },
  {
    id: "thor",
    label: "$(flame) Thor",
    filename: "Thor.png",
    imageWidth: 180,
  },
  {
    id: "blackpanther",
    label: "$(shield) Black Panther",
    filename: "Black_anther.png",
    imageWidth: 180,
  },
];

export function activate(context: vscode.ExtensionContext) {
  let panel: vscode.WebviewPanel | undefined;

  const getCharacter = (id: string): Character =>
    CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0];

  async function chooseCharacter(): Promise<Character | undefined> {
    const savedId = context.workspaceState.get<CharacterId>(
      "selectedCharacter",
      "spiderman",
    );

    const selected = await vscode.window.showQuickPick(
      CHARACTERS.map((character) => ({
        label: character.label,
        id: character.id,
      })),
      {
        title: "Marvel Companion",
        placeHolder: "Choose your Marvel character",
        ignoreFocusOut: true,
      },
    );

    if (!selected) {
      return undefined;
    }

    await context.workspaceState.update("selectedCharacter", selected.id);

    return getCharacter(selected.id);
  }

  function showCharacter(character: Character) {
    if (!panel) {
      panel = vscode.window.createWebviewPanel(
        "marvelCompanion",
        `${character.label.replace(/\$\([^)]+\)\s*/, "")} Companion`,
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "media"),
          ],
        },
      );

      panel.onDidDispose(() => {
        panel = undefined;
      });
    } else {
      panel.reveal(vscode.ViewColumn.Active);
    }

    const imageUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "media", character.filename),
    );

    panel.title = `${character.label.replace(/\$\([^)]+\)\s*/, "")} Companion`;

    panel.webview.html = getHtml(
      panel.webview.cspSource,
      imageUri.toString(),
      character.label.replace(/\$\([^)]+\)\s*/, ""),
      character.imageWidth,
      randomBytes(16).toString("base64"),
      character.showWeb ?? false,
    );
  }

  async function startCompanion() {
    const character = await chooseCharacter();

    if (character) {
      showCharacter(character);
    }
  }

  const startCommand = vscode.commands.registerCommand(
    "marvel-companion.start",
    startCompanion,
  );

  const changeCommand = vscode.commands.registerCommand(
    "marvel-companion.changeCharacter",
    startCompanion,
  );

  context.subscriptions.push(startCommand, changeCommand);
}

function getHtml(
  cspSource: string,
  imageUri: string,
  characterName: string,
  imageWidth: number,
  nonce: string,
  showWeb: boolean,
): string {
  const webSvg = showWeb
    ? `<svg id="web" aria-hidden="true">
      <path id="thread"></path>
    </svg>`
    : "";

  const webScript = showWeb
    ? `<script nonce="${nonce}">
    const character = document.getElementById("character");
    const thread = document.getElementById("thread");
    const stage = document.getElementById("stage");

    function updateWeb() {
      if (!character.naturalWidth) return;

      const imageRect = character.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();

      const anchorX =
        imageRect.left - stageRect.left + imageRect.width * 0.51;

      const anchorY =
        imageRect.top - stageRect.top + 2;

      thread.setAttribute(
        "d",
        "M " + anchorX + " 0 L " + anchorX + " " + anchorY
      );
    }

    character.addEventListener("load", updateWeb);
    window.addEventListener("resize", updateWeb);

    if (character.complete && character.naturalWidth > 0) {
      updateWeb();
    }
  </script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
  >

  <title>${characterName} Companion</title>

  <style>
    * {
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent !important;
    }

    #stage {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }

    #web {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    #thread {
      fill: none;
      stroke: var(--vscode-editor-foreground, #ffffff);
      stroke-width: 1.5;
      stroke-linecap: round;
      opacity: 0.85;
    }

    #character {
      position: absolute;
      top: 0;
      right: 0;
      width: clamp(80px, 25vw, ${imageWidth}px);
      height: auto;
      max-height: 95%;
      object-fit: contain;
      object-position: top right;
      display: block;
      pointer-events: none;
      user-select: none;
    }
  </style>
</head>

<body>
  <div id="stage">
    ${webSvg}

    <img
      id="character"
      src="${imageUri}"
      alt="${characterName}"
    >
  </div>

  ${webScript}
</body>
</html>`;
}

export function deactivate() {}
