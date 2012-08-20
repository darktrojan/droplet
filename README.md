Droplet
=======

Droplet is an AJAX uploader supporting drag-and-drop, with a progress bar and an image resizer. It's known to be compatible with Firefox and Chrome, and possibly other browsers.

To use, add the javascript and CSS in the page, then set `Droplet.form` to your upload form (the form is used as a fallback if Droplet is incompatible, and other form widgets can also be used), and `Droplet.zones` to an array of elements that will accept dropped files:

	Droplet.form = document.getElementById('form');
	// use [document.documentElement] if the whole page should accept dropped files
	Droplet.zones = [document.getElementById('zone')];

To do something on completion of upload, set an `uploadComplete` callback:

	Droplet.uploadComplete = function (req) {
		document.getElementById('output').textContent = req.responseText;
	};

Image Resizer
-------------

Droplet can reduce PNG or JPEG files before upload to save upload time. To use this feature, set a maximum width and height for images. If you set a threshold, images won't be scaled if the size of the reduction is greater than the threshold (in this case if they're already smaller than `800/0.9=889px`).

	Droplet.maxWidth = Droplet.maxHeight = 800;
	Droplet.threshold = 0.9;
