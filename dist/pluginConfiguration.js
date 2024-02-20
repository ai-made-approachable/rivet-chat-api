const pluginConfigurations = [
    {
        envVar: 'CHROMADB_PLUGIN',
        importPath: 'rivet-plugin-chromadb',
        isBuiltIn: false,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(plugin(Rivet)),
        settings: {
            envVarPrefix: 'CHROMA',
            settingsKey: 'chroma',
            settingsStructure: {
                databaseUri: 'DATABASE_URI',
            },
        },
    },
    {
        envVar: 'GOOGLE_PLUGIN',
        isBuiltIn: true,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(Rivet.googlePlugin),
        settings: {
            envVarPrefix: 'GOOGLE',
            settingsKey: 'google',
            settingsStructure: {
                googleProjectId: 'PROJECT_ID',
                googleRegion: 'REGION',
                googleApplicationCredentials: 'APPLICATION_CREDENTIALS',
            },
        },
    },
    {
        envVar: 'ANTHROPIC_PLUGIN',
        isBuiltIn: true,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(Rivet.anthropicPlugin),
        settings: {
            envVarPrefix: 'ANTHROPIC',
            settingsKey: 'anthropic',
            settingsStructure: {
                anthropicApiKey: 'API_KEY',
            },
        },
    },
    {
        envVar: 'ASSEMBLYAI_PLUGIN',
        isBuiltIn: true,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(Rivet.assemblyAiPlugin),
        settings: {
            envVarPrefix: 'ASSEMBLYAI',
            settingsKey: 'assemblyAi',
            settingsStructure: {
                assemblyAiApiKey: 'API_KEY',
            },
        },
    },
    {
        envVar: 'AUTOEVALS_PLUGIN',
        isBuiltIn: true,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(Rivet.autoevalsPlugin),
        settings: {
            envVarPrefix: 'AUTOEVALS',
            settingsKey: 'autoevals'
        },
    },
    {
        envVar: 'HUGGINGFACE_PLUGIN',
        isBuiltIn: true,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(Rivet.huggingFacePlugin),
        settings: {
            envVarPrefix: 'HUGGINGFACE',
            settingsKey: 'huggingface',
            settingsStructure: {
                huggingFaceAccessToken: 'ACCESS_TOKEN',
            },
        },
    },
    {
        envVar: 'OPENAI_PLUGIN',
        isBuiltIn: true,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(Rivet.openAIPlugin),
        settings: {
            envVarPrefix: 'OPENAI',
            settingsKey: 'openai',
        },
    },
    {
        envVar: 'PINECONE_PLUGIN',
        isBuiltIn: true,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(Rivet.pineconePlugin),
        settings: {
            envVarPrefix: 'PINECONE',
            settingsKey: 'pinecone',
            settingsStructure: {
                pineconeApiKey: 'API_KEY',
            },
        },
    },
    {
        envVar: 'MONGODB_PLUGIN',
        importPath: 'rivet-plugin-mongodb',
        isBuiltIn: false,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(plugin(Rivet)),
        settings: {
            envVarPrefix: 'MONGODB',
            settingsKey: 'mongoDB',
            settingsStructure: {
                mongoDBConnectionString: 'CONNECTION_STRING',
            },
        },
    },
    {
        envVar: 'OLLAMA_PLUGIN',
        importPath: 'rivet-plugin-ollama',
        isBuiltIn: false,
        registerFunction: (plugin, Rivet) => Rivet.globalRivetNodeRegistry.registerPlugin(plugin(Rivet)),
        settings: {
            envVarPrefix: 'OLLAMA',
            settingsKey: 'ollama',
            settingsStructure: {
                host: 'HOST',
            },
        },
    },
];
const registeredPlugins = {};
export async function setupPlugins(Rivet) {
    let pluginSettings = {};
    console.log("Starting plugin registration...");
    for (const config of pluginConfigurations) {
        if (process.env[config.envVar] === 'true') {
            // Skip registration if the plugin has already been registered
            if (registeredPlugins[config.settings.settingsKey]) {
                console.log(`${config.settings.settingsKey} plugin already registered.`);
            }
            let plugin = null;
            if (!config.isBuiltIn) {
                const module = await import(config.importPath);
                plugin = module.default ? module.default : module;
            }
            try {
                // Perform registration if the plugin hasn't been registered yet
                if (!registeredPlugins[config.settings.settingsKey]) {
                    config.registerFunction(plugin, Rivet);
                    console.log(`Successfully registered ${config.settings.settingsKey} plugin.`);
                    // Mark plugin as registered
                    registeredPlugins[config.settings.settingsKey] = true;
                }
            }
            catch (error) {
                console.warn(`Failed to register ${config.settings.settingsKey} plugin: ${error.message}`);
            }
            // Prepare plugin-specific settings if needed
            const pluginSpecificSettings = {};
            let missingEnvVars = []; // To store missing environment variables
            if (config.settings && config.settings.settingsStructure) {
                for (const [settingKey, envSuffix] of Object.entries(config.settings.settingsStructure)) {
                    // Construct the full environment variable name
                    const fullEnvName = `${config.settings.envVarPrefix}_${envSuffix}`;
                    // Fetch the value from the environment variables
                    const value = process.env[fullEnvName];
                    if (value !== undefined) {
                        pluginSpecificSettings[settingKey] = value;
                    }
                    else {
                        missingEnvVars.push(fullEnvName); // Add missing env var to the list
                    }
                }
                if (missingEnvVars.length > 0) {
                    // Log missing environment variables as a warning
                    console.warn(`[Warning] Missing environment variables for the '${config.settings.settingsKey}' plugin: ${missingEnvVars.join(', ')}.`);
                }
                // Assign the settings to the appropriate key in pluginSettings
                if (Object.keys(pluginSpecificSettings).length > 0) {
                    pluginSettings[config.settings.settingsKey] = pluginSpecificSettings;
                }
            }
        }
    }
    // Optionally, log a summary or a positive confirmation message at the end
    console.log("Plugin registration complete.");
    return pluginSettings;
}
export function logAvailablePluginsInfo() {
    console.log("Available Plugins and Required Environment Variables:");
    console.log("-----------------------------------------------------");
    pluginConfigurations.forEach(config => {
        // Log the plugin's activation environment variable
        console.log(`Plugin: ${config.settings.settingsKey}`);
        console.log(`  Activate with env var: ${config.envVar} (set to 'true' to enable)`);
        // Check and log required environment variables for settings
        if (config.settings && config.settings.settingsStructure) {
            Object.entries(config.settings.settingsStructure).forEach(([settingKey, envSuffix]) => {
                const fullEnvName = `${config.settings.envVarPrefix}_${envSuffix}`;
                console.log(`  Required env var for ${settingKey}: ${fullEnvName}`);
            });
        }
        console.log("-----------------------------------------------------");
    });
}
//# sourceMappingURL=pluginConfiguration.js.map