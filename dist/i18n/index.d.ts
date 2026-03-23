/**
 * Internationalization (i18n) for Synaptic Code
 * Supports: English (en), Japanese (ja)
 */
export type Language = 'en' | 'ja';
/**
 * Detect system language
 * Returns 'ja' if Japanese, otherwise 'en'
 */
export declare function detectSystemLanguage(): Language;
export interface Translations {
    languageName: string;
    systemPrompt: string;
    ui: {
        inputPlaceholder: string;
        commands: string;
        exit: string;
        undo: string;
        scrollPause: string;
        pressEscToCancel: string;
        thinking: string;
        toolExecuting: string;
        toolComplete: string;
        toggleConfirm: string;
    };
    status: {
        model: string;
        context: string;
        tools: string;
        compressed: string;
        autoAccept: string;
        confirmMode: string;
    };
    commands: {
        newConversation: string;
        clearScreen: string;
        selectModel: string;
        selectProvider: string;
        showTodo: string;
        showTools: string;
        showConfig: string;
        showHelp: string;
        changeLanguage: string;
        refreshSynaptic: string;
        quit: string;
    };
    commandDescriptions: {
        help: string;
        model: string;
        provider: string;
        new: string;
        history: string;
        clear: string;
        compact: string;
        agent: string;
        todo: string;
        language: string;
        license: string;
        tools: string;
        config: string;
        synaptic: string;
        self: string;
        timeline: string;
        diff: string;
        quit: string;
    };
    messages: {
        startedNewConversation: string;
        modelChangedTo: string;
        responseCancelled: string;
        noUndoPoints: string;
        nothingToRestore: string;
        forkedConversation: string;
        restoredFiles: string;
        autoAcceptOn: string;
        autoAcceptOff: string;
        planRejected: string;
    };
    setup: {
        welcome: string;
        localAiAssistant: string;
        wizardIntro: string;
        startSetup: string;
        runLater: string;
        step1Title: string;
        lmStudioInstalled: string;
        lmStudioNotFound: string;
        lmStudioDesc: string;
        openDownloadPage: string;
        instructions: string;
        downloadAndInstall: string;
        openLmStudioOnce: string;
        enableCli: string;
        pressEnterWhenDone: string;
        lmStudioDetected: string;
        continueWithoutLmStudio: string;
        step2Title: string;
        cliEnabled: string;
        cliNotEnabled: string;
        cliInstructions: string[];
        openLmStudio: string;
        pressEnterWhenCliEnabled: string;
        cliDetected: string;
        continuingWithoutCli: string;
        step3Title: string;
        checkingServer: string;
        startingServer: string;
        serverNotRunning: string;
        startServerInstructions: string[];
        pressEnterWhenServerRunning: string;
        serverRunning: string;
        serverNotResponding: string;
        startServerLater: string;
        modelLoaded: string;
        noModelsInstalled: string;
        systemRam: string;
        recommendedModel: string;
        minRam: string;
        alternatives: string;
        downloadModelNow: string;
        downloading: string;
        downloadSuccess: string;
        downloadFailed: string;
        tryManually: string;
        alternativeModels: string;
        pressEnterWhenModelDownloaded: string;
        openDownloadPageFor: string;
        downloadInLmStudio: string;
        waitForDownload: string;
        noModelsFound: string;
        selectModelToLoad: string;
        availableModels: string;
        loadingModel: string;
        modelLoadSuccess: string;
        modelLoadFailed: string;
        cancel: string;
        selectModelPrompt: string;
        advancedModels: string;
        modelDesc: {
            qwen35_35b: string;
            gptOss20b: string;
            qwen35_14b: string;
            gemma3_12b: string;
            qwen35_9b: string;
            gemma3_4b: string;
            qwen35_27b: string;
            qwen35_122b: string;
            llama4Maverick: string;
            deepseekR1: string;
        };
        step4Title: string;
        testingConnection: string;
        aiResponded: string;
        serverError: string;
        connectionFailed: string;
        setupCompleteTitle: string;
        setupReady: string;
        runToChat: string;
        runHelp: string;
        setupIncomplete: string;
        finishLater: string;
    };
    license: {
        title: string;
        stepTitle: string;
        currentStatus: string;
        statusValid: string;
        statusTrial: string;
        statusExpired: string;
        statusNone: string;
        statusOffline: string;
        enterKey: string;
        enterEmail: string;
        activating: string;
        activationSuccess: string;
        activationFailed: string;
        invalidFormat: string;
        startTrial: string;
        trialStarted: string;
        trialExpired: string;
        purchasePrompt: string;
        purchaseUrl: string;
        skipForNow: string;
        continueWithTrial: string;
        trialRemaining: string;
        licenseRequired: string;
        activated: string;
        platform: string;
        needLicense: string;
        openPurchasePage: string;
        networkRequired: string;
        continueTrial: string;
        trialDaysRemaining: string;
        registering: string;
    };
}
export declare function setLanguage(lang: Language): void;
export declare function getLanguage(): Language;
export declare function t(): Translations;
/**
 * Format a translation string with placeholders
 * e.g., format(t().messages.modelChangedTo, { model: 'gpt-4' })
 */
export declare function format(template: string, values: Record<string, string | number>): string;
/**
 * Get all available languages with their display names
 */
export declare function getAvailableLanguages(): Array<{
    code: Language;
    name: string;
}>;
//# sourceMappingURL=index.d.ts.map