export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = reader.result.replace(
                /^data:image\/[a-z]+;base64,/,
                ""
            );
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });
};
