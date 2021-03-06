/* globals Uint8Array, ArrayBuffer */
var Droplet = {
	maxHeight: 0,
	maxWidth: 0,
	threshold: 1,
	quality: 0.8,
	zones: [document.documentElement],
	form: null,
	onload: function() {
		if (window.removeEventListener) {
			window.removeEventListener('DOMContentLoaded', Droplet.onload, false);
			window.removeEventListener('load', Droplet.onload, false);
		}
		Droplet.init();
	},
	init: function() {
		if ('FormData' in window && 'FileReader' in window) {
			var self = this;
			for (var i = 0; i < this.zones.length; i++) {
				this.initZone(this.zones[i]);
			}
			this.notification.init();
			this.form.onsubmit = function() {
				return self.formSubmit();
			};
		}
	},
	initZone: function(zone) {
		zone.addEventListener('dragenter', function(event) {
			Droplet.onEnter(event);
		}, false);
		zone.addEventListener('dragover', function(event) {
			Droplet.onOver(event);
		}, false);
		zone.addEventListener('drop', function(event) {
			Droplet.onDrop(event);
		}, false);
	},
	onEnter: function(event) {
		event.stopPropagation();
		event.preventDefault();
	},
	onOver: function(event) {
		event.stopPropagation();
		event.preventDefault();
	},
	onDrop: function(event) {
		if (!event.dataTransfer.files.length) {
			return;
		}

		event.stopPropagation();
		event.preventDefault();

		// have to do this to prevent the form inputs from being uploaded too
		var inputs = this.form.querySelectorAll('input[type="file"]');
		for (var i = 0; i < inputs.length; i++) {
			inputs[i].value = '';
		}

		this.uploadFiles(event.dataTransfer.files);
	},
	formSubmit: function() {
		try {
			var files = [];
			var inputs = this.form.querySelectorAll('input[type="file"]');
			for (var i = 0; i < inputs.length; i++) {
				var input = inputs[i];
				for (var j = 0; j < input.files.length; j++) {
					files.push(input.files[j]);
				}
				input.value = '';
				input.parentNode.replaceChild(input.cloneNode(), input);
			}
			this.uploadFiles(files);
			return false;
		} catch (e) {
			// console.error(e);
		}
		return true;
	},
	uploadFiles: function(files) {
		var self = this;
		var items = [];
		var names = [];
		var total = files.length;
		var xhr = new XMLHttpRequest();

		xhr.open('POST', this.form.action, true);
		xhr.withCredentials = true;
		xhr.upload.addEventListener('progress', function(event) {
			if (event.lengthComputable) {
				self.notification.setValue(event.loaded / event.total * 100);
			}
		}, false);
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4) {
				if (xhr.status == 200) {
					self.notification.setValue(100);
					self.notification.hide();
					if (typeof self.uploadComplete == 'function') {
						self.uploadComplete(xhr);
					}
				} else {
					if (typeof self.onerror == 'function') {
						self.onerror(xhr);
					} else {
						alert('Error ' + xhr.status + ' occurred uploading your file.');
					}
					self.notification.hide();
				}
			}
		};

		function addItem(name, item) {
			try {
				item = new File([item], name, {'type': item.type});
				// console.debug('Used File constructor');
			} catch (ex) {
				// console.error('File constructor failed');
			}
			names.push(name);
			items.push(item);
			checkSend();
		}

		function checkSend() {
			// console.debug('checkSend: ' + items.length + '/' + total);
			if (items.length < total)
				return;

			var data = new FormData(self.form);
			for (var i = 0; i < total; i++) {
				data.append('upload[' + i + ']', items[i]);
				data.append('upload_names[' + i + ']', names[i]);
			}

			self.notification.show(names);
			xhr.send(data);
			// console.debug('sent');
		}

		function resize(file) {
			// console.debug('resize: ' + file.name);
			if (!self.maxWidth || !self.maxHeight || (file.type != 'image/jpeg' && file.type != 'image/png')) {
				// console.debug(file.name + ' was not resized');
				return false;
			}
			var image = document.createElement('img');
			image.onload = function() {
				URL.revokeObjectURL(this.src);

				var ratio = Math.min(Droplet.maxWidth / image.width, Droplet.maxHeight / image.height);
				var canvas = document.createElement('canvas');
				var context = canvas.getContext('2d');
				if (ratio > self.threshold) {
					canvas.width = image.width;
					canvas.height = image.height;
					context.drawImage(image, 0, 0);
				} else {
					canvas.width = Math.floor(image.width * ratio + 0.025);
					canvas.height = Math.floor(image.height * ratio + 0.025);
					context.drawImage(image, 0, 0, image.width * ratio, image.height * ratio);
				}

				if ('toBlob' in canvas) {
					// console.debug('canvas.toBlob');
					canvas.toBlob(function(blob) {
						addItem(file.name, blob);
					}, file.type, Droplet.quality);
				} else if ('mozGetAsFile' in canvas) {
					// console.debug('canvas.mozGetAsFile');
					addItem(file.name, canvas.mozGetAsFile(file.name, file.type));
				} else {
					// console.debug('canvas.toDataURL');
					var dataURL = canvas.toDataURL(file.type, Droplet.quality);
					var byteString = atob(dataURL.split(',')[1]);

					var ab = new ArrayBuffer(byteString.length);
					var ia = new Uint8Array(ab);
					for (var i = 0; i < byteString.length; i++) {
						ia[i] = byteString.charCodeAt(i);
					}

					addItem(file.name, new Blob([ia]));
				}
			};

			image.src = URL.createObjectURL(file);
			return true;
		}

		// console.debug('starting resize');
		for (var i = 0; i < total; i++) {
			if (!resize(files[i])) {
				items.push(files[i]);
				names.push(files[i].name);
			}
		}
		// console.debug('all resize operations started');
		checkSend();
	},
	notification: {
		init: function() {
			this.element = document.createElement('div');
			this.element.id = 'droplet-notification';
			this.element.innerHTML =
				'<div id="droplet-title">Uploading…</div>' +
				'<div id="droplet-filenames"></div>' +
				'<div id="droplet-progressbar"><div id="droplet-progress"></div></div>';
			document.body.appendChild(this.element);

			this.filenames = document.getElementById('droplet-filenames');
			this.progress = document.getElementById('droplet-progress');
		},
		setValue: function(value) {
			this.progress.style.width = Math.floor(value) + '%';
		},
		show: function(filenames) {
			this.progress.style.width = 0;
			while (this.filenames.lastChild)
				this.filenames.removeChild(this.filenames.lastChild);

			for (var i = 0; i < filenames.length; i++) {
				var div = document.createElement('div');
				div.appendChild(document.createTextNode(filenames[i]));
				this.filenames.appendChild(div);
			}
			this.element.classList.add('visible');
		},
		hide: function() {
			var self = this;
			setTimeout(function() {
				self.element.classList.remove('visible');
			}, 1000);
			setTimeout(function() {
				self.progress.style.width = 0;
			}, 2000);
		}
	}
};

if (window.addEventListener) {
	window.addEventListener('DOMContentLoaded', Droplet.onload, false);
	window.addEventListener('load', Droplet.onload, false);
}
