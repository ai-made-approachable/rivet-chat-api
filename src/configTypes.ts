export type ServerConfig = {
    port: number;
    file: string;
    graphName: string;
    graphInputName: string;
    streamingOutput: {
        nodeType: string;
        nodeName: string;
    };
    returnGraphOutput: boolean;
    graphOutputName: string;
    textToSpeech: boolean;
    textToSpeechVoice?: string;
};