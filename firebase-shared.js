(() => {
	const config = window.firebaseConfig || {};
	const configured = config.apiKey && !config.apiKey.startsWith('PASTE_') && window.firebase;
	let database = null;
	let initializationError = null;

	if (configured) {
		try {
			firebase.initializeApp(config);
			database = firebase.firestore();
		} catch (error) {
			initializationError = error;
		}
	}

	window.newsFirebase = {
		enabled: Boolean(database),
		initializationError,
		async loadStories() {
			if (!database) return [];
			const snapshot = await database.collection('stories').orderBy('createdAt', 'desc').get();
			return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
		},
		watchStories(onChange) {
			if (!database) return () => {};
			return database.collection('stories').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
				onChange(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
			});
		},
		async saveStory(story, imageFile, existingId = null, existingImage = '') {
			if (!database) return null;
			const storyId = existingId || database.collection('stories').doc().id;
			let image = existingImage || story.image || '';
			if (imageFile) image = await compressImage(imageFile);
			const record = { ...story, image, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
			if (!existingId) record.createdAt = firebase.firestore.FieldValue.serverTimestamp();
			await database.collection('stories').doc(storyId).set(record, { merge: true });
			return { id: storyId, ...story, image };
		},
		async deleteStory(storyId) {
			if (database && storyId) await database.collection('stories').doc(storyId).delete();
		},
		prepareImage: compressImage,
	};

	function compressImage(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () => reject(new Error('The image could not be read.'));
			reader.onload = () => {
				const source = new Image();
				source.onerror = () => reject(new Error('The selected file is not a valid image.'));
				source.onload = () => {
					const scale = Math.min(1, 800 / source.width, 560 / source.height);
					const canvas = document.createElement('canvas');
					canvas.width = Math.max(1, Math.round(source.width * scale));
					canvas.height = Math.max(1, Math.round(source.height * scale));
					const context = canvas.getContext('2d');
					if (!context) {
						reject(new Error('The image could not be prepared.'));
						return;
					}
					context.drawImage(source, 0, 0, canvas.width, canvas.height);
					resolve(canvas.toDataURL('image/jpeg', 0.65));
				};
				source.src = reader.result;
			};
			reader.readAsDataURL(file);
		});
	}
})();
