
With this project you can use "Chatbot-UI" as user interface for your Rivet projects!
This allows you to create complex LLM based processes (e.g. a teachable assistant) in a visual programming interface and interact with it via a beautiful chat UI. Chatbot-UI also keeps all the conversation history, so we do not need to care about that!

Features:
- Creates an OpenAI SDK compatible API for any rivet project
- Captures streaming output from a configured node
- Streams the output
- Transforms messages, before sending them to the rivet graph
- Beautiful Chat-UI (provided by Chatbot-UI)
- Chatbot-UI features: Multiple chats with conversation history, Integrated RAG etc.

Currently not supported (maybe added in the future):
- System prompts and LLM settings (e.g. temperature) set in Chatbot-UI interface are currently not being send to the graph
- Tools added in Chatbot-UI will not be passed

![Chat UI for Rivet!](/chat_ui.png "Chat UI for Rivet!")

# Last updates 04. Feb 2024
- Now supports parallel requesting. So multiple users can chat with the same rivet graph at the same time
- Multiple rivet graphs/projects can be served on different ports
- API Key was added for security
- Better error handling, so failed Rivet graphs will not break the application

# Project setup
For simplicity all is explained for Visual Studio Code. You can of course run it in other IDEs.

## Software installation (prerequisites)
1. Install **Visual Studio Code**: https://code.visualstudio.com/download
1. Install **node.js + node package manager**: https://nodejs.org/en/download/ (in the install process, make sure you also install npm package manager!)
1. Install **Github**: https://desktop.github.com/

## Clone the repo
1. Open terminal or command line
1. Enter ```git clone https://github.com/ai-made-approachable/rivet-chat-api.git```

## Configure the project
1. Open the folder in Visual Studio Code (File -> Open Folder)
1. Open "Terminal -> New Terminal" and enter ```npm install```
1. Go to /.vscode/ folder
1. Rename "launch_sample.json" to "launch.json"
1. Open "launch.json" and replace the value for OPEN_API_KEY with your OpenAI Key

## Running the project
Just press "Run -> Start Debugging" in Visual Studio Code.
Continue with the "Chat setup". The URLs displayed are the endpoints to connect the chat to rivet-chat-api.

## Use your own project files
- Make sure your project file has an input of type "chat-message" and array checked (Type: chat-message[])
- Open ```config/default.json```
- Change the values accordingly to your graph (file, graphName, graphInput ...)

## Using plugins
If you want to use plugins, you need to import and register them first in graphManager.ts

Example for mongoDB Plugin
```
import rivetMongoDbPlugin from 'rivet-plugin-mongodb';
import * as Rivet from '@ironclad/rivet-node';
Rivet.globalRivetNodeRegistry.registerPlugin(rivetMongoDbPlugin(Rivet));
```

---
# Chat setup
We are using "Chatbot-UI" as it is a very user friendly UI (similiar to ChatGPTs UI): https://github.com/mckaywrigley/chatbot-ui

## Software installation (prerequisites)
1. Install **Docker**: https://docs.docker.com/engine/install/

## Install Chatbot-UI
Note: This installation is a bit long, but it is a one time thing!

1. Open terminal (MacOs) or command line (Windows)
1. ```git clone https://github.com/mckaywrigley/chatbot-ui.git```
1. Navigate into the folder of the repository ```cd chatbot-ui```
1. Install dependencies ```npm install```
1. Install superbase: ```npm install supabase```
1. Make sure Docker is running
1. Start Supabase ```supabase start```
1. Create file .env.local ```cp .env.local.example .env.local```
1. Get the required values by running ```supabase status```
1. Copy "API URL" value
1. Open ".env.local" in Visual Studio Code (in chatbot-ui root folder)
1. Insert copied value for "NEXT_PUBLIC_SUPABASE_URL" and save
1. Open ```supabase/migrations/20240108234540_setup.sql``` file
1. Replace "service_role_key" with the value from ```supabase status``` and save

Note: Also see instructions on: https://github.com/mckaywrigley/chatbot-ui

## Starting the Chat-UI
1. Make sure Docker is running
1. Navigate to your "chatbot-ui" folder
1. Enter ```npm run chat```
1. Navigate to the URL shown to you, usually: http://localhost:3000

## Configure the Chat-UI
1. When you start "chatbot-ui" for the first time enter e-mail + password (don't worry, all stays locally on your pc)
1. In the sidebar press on "Models" (Stars-Icon) and on "New Model"
1. Enter any name. but use ```gpt-4-turbo-preview``` as ModelID (Note: when adding multiple graphs, you need to chose another model from this list for each one of them. Otherwise Chatbot-UI does not properly work: https://github.com/mckaywrigley/chatbot-ui/blob/3cfb3f3762ef3237800c92d6598c779ea4caf757/lib/chat-setting-limits.ts#L63)
1. Enter ```http://localhost:3100/``` as Base URL (change port accordingly if you run multiple graphs according to default.json) 
1. As API_Key set the value you defined in your config/default.json file
1. Open the model selection in the top-right corner and select your custom model
1. Have fun chatting
