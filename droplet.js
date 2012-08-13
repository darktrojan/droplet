var Droplet = {
	maxHeight: 0,
	maxWidth: 0,
	threshold: 1,
	zones: [document.documentElement],
	form: null,
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
				for (var j = 0; j < inputs[i].files.length; j++) {
					files.push(inputs[i].files[j]);
				}
				inputs[i].value = '';
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

		function checkSend() {
			// console.debug('checkSend: ' + items.length + '/' + total);
			if (items.length < total)
				return;

			var data = new FormData(self.form);
			for (var i = 0; i < total; i++) {
				data.append('upload[]', items[i]);
			}

			self.notification.show(names);
			xhr.send(data);
			// console.log('sent');
		}

		function resize(file) {
			// console.debug('resize: ' + file.name);
			if (!self.maxWidth || !self.maxHeight || (file.type != 'image/jpeg' && file.type != 'image/png')) {
				// console.log(file.name + ' was not resized');
				return false;
			}
			var image = document.createElement('img');
			image.onload = function() {
				if ('URL' in window) {
					// console.log('URL.revokeObjectURL');
					URL.revokeObjectURL(file);
				}

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

				names.push(file.name);
				if ('toBlob' in canvas) {
					// console.log('canvas.toBlob');
					canvas.toBlob(function(blob) {
						items.push(blob);
						checkSend();
					}, file.type);
					return;
				} else if ('mozGetAsFile' in canvas) {
					// console.log('canvas.mozGetAsFile');
					items.push(canvas.mozGetAsFile(file.name, file.type));
				} else {

					var dataURL = canvas.toDataURL(file.type);
					var byteString = atob(dataURL.split(',')[1]);

					var ab = new ArrayBuffer(byteString.length);
					var ia = new Uint8Array(ab);
					for (var i = 0; i < byteString.length; i++) {
						ia[i] = byteString.charCodeAt(i);
					}

					if ('Blob' in window) {
						// console.log('canvas.toDataURL used with Blob constructor');
						var b = new Blob([ia]);
						items.push(b);
					} else {
						// console.log('canvas.toDataURL used with BlobBuilder');
						var bb = 'BlobBuilder' in window ? new BlobBuilder() : new WebKitBlobBuilder();
						bb.append(ia);
						items.push(bb.getBlob(file.type));
					}
				}
				checkSend();
			}
			if ('URL' in window) {
				// console.log('URL.createObjectURL');
				image.src = URL.createObjectURL(file);
			} else {
				// console.log('FileReader.readAsDataURL');
				var reader = new FileReader();
				reader.onload = function() {
					image.src = this.result;
				}
				reader.name = file.name;
				reader.readAsDataURL(file);
			}
			return true;
		}

		// console.log('starting resize');
		for (var i = 0; i < total; i++) {
			if (!resize(files[i])) {
				items.push(files[i]);
				names.push(files[i].name);
			}
		}
		// console.log('all resize operations started');
		checkSend();
	},
	notification: {
		init: function() {
			var self = this;

			this.element = $e(document.body, 'div', null, { id: 'droplet-notification' });
			this.element.style.visibility = 'hidden';

			this.title = $e(this.element, 'div', 'Uploading\u2026', { style: 'font-weight: bold;' });
			this.filename = $e(this.element, 'div', null, { style: 'margin: 5px 0; line-height: 150%;' });
			this.bar = $e(this.element, 'div', null, { id: 'droplet-progressbar' });
			this.progress = $e(this.bar, 'div', null, { id: 'droplet-progress' });
			this.transitionEvent;

			if ('MozTransition' in this.element.style)
				this.transitionEvent = 'transitionend';
			else if ('WebkitTransition' in this.element.style)
				this.transitionEvent = 'webkitTransitionEnd';
			else if ('OTransition' in this.element.style)
				this.transitionEvent = 'oTransitionEnd';
			if (this.transitionEvent) {
				this.element.addEventListener(this.transitionEvent, function(event) {
					if (event.target == this && !$cnc(this, 'visible')) {
						this.style.visibility = 'hidden';
						self.progress.style.width = 0;
					}
				}, false);
			}
		},
		setValue: function(value) {
			this.progress.style.width = Math.floor(value) + '%';
		},
		show: function(filenames) {
			this.filename.innerHTML = filenames.join('<br />');
			this.element.style.visibility = 'visible';
			$cna(this.element, 'visible');
		},
		hide: function() {
			var self = this;
			setTimeout(function() {
				$cnr(self.element, 'visible');
			}, 1000);
			setTimeout(function() {
				self.progress.style.width = 0;
			}, 2000);
		}
	}
};

_loadList.push(function() { Droplet.init() });
