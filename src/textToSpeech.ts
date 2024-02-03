import { OpenAI } from 'openai';
import Speaker from 'speaker';
import { spawn } from 'child_process';
import { Speech } from 'openai/resources/audio/speech';
import config from 'config';

const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
});

export async function textToSpeech(text: string): Promise<void> {
    const params: Speech.SpeechCreateParams = {
        input: text,
        model: 'tts-1',
        voice: config.get('textToSpeechVoice'),
        response_format: 'mp3',
        speed: 1.1,
    };

    try {
        const response = await openai.audio.speech.create(params);

        // Set up ffmpeg to decode MP3 to PCM
        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0', // Input from stdin
            '-f', 's16le', // PCM format
            '-ar', '44100', // Sample rate
            '-ac', '2', // Stereo
            'pipe:1' // Output to stdout
        ]);

        // Pipe the OpenAI response stream to ffmpeg's stdin
        response.body.pipe(ffmpeg.stdin);

        // Set up Speaker with the expected PCM format
        const speaker = new Speaker({
            channels: 2,
            bitDepth: 16,
            sampleRate: 44100,
        });

        // Pipe ffmpeg's stdout to Speaker
        ffmpeg.stdout.pipe(speaker);

        return new Promise((resolve, reject) => {
            speaker.on('close', resolve);
            ffmpeg.on('error', reject);
            speaker.on('error', reject);
        });

    } catch (error) {
        console.error('Error in textToSpeech:', error);
        throw error;
    }
}
