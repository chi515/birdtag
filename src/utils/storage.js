const storagePrefix = "CognitoIdentityServiceProvider";

const storage = {
    getPrefix: () => {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(storagePrefix)) {
                // Extract the prefix
                const parts = key.split(".");
                if (parts.length > 2) {
                    return `${parts[0]}.${parts[1]}.${parts[2]}`;
                }
            }
        }
        return null;
    },
    getToken: () => {
        const prefix = storage.getPrefix();
        if (!prefix) {
            return null;
        }

        const token = window.localStorage.getItem(`${prefix}.idToken`);
        if (token) {
            return token;
        }
        return null;
    },
};

export default storage;
