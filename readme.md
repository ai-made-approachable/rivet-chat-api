# About this project
This github project is a demo to help non-devs to get started executing their rivet graphs in node.js
As the official docs require us to run a TypeScript application this might prove a considerable challenge to any non-developer. So this project includes everything you need to be able to run it immediately in Visual Studio Code with a few simple steps.

## Software installation (prerequisites)
1. Install **Visual Studio Code**: https://code.visualstudio.com/download
2. Install **node.js + node package manager**: https://nodejs.org/en/download/ 
 (in the install process, make sure you also install npm package manager!)
3. (Optional) Install **Github**: https://desktop.github.com/

## Clone the repo
1. Go to https://github.com/ai-made-approachable/rivet-node-basic-example
1. Either press "<> Code", "Download ZIP" and unzip the project somewhere OR use ```git clone https://github.com/ai-made-approachable/rivet-node-basic-example.git```

## Configure the project
1. Go to /.vscode/ folder
2. Rename "launch_sample.json" to "launch.json"
3. Open "launch.json" and replace the value for OPEN_API_KEY with your OpenAI Key
4. Open "Terminal -> New Terminal" and enter ```npm install```

## Running the project
Just press "Run -> Start Debugging" in Visual Studio Code. Results can be seen in the "DEBUG CONSOLE"

## How to adjust the project to your own rivet graphs
- Add your own Rivet projects to the root folder of the project
- Edit "rivet.ts" in /src" folder and update "project" and "graph" variables
- Change inputs (can also be left empty = ```"inputs": {}```)
- Adjust output "result.response.value" accordingly to your graph outputs (if you have any)
