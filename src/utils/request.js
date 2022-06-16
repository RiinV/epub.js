import {defer, isXml, parse} from "./core";
import Path from "./path";

function request(url, type, withCredentials, headers, encryption) {
	var supportsURL = (typeof window != "undefined") ? window.URL : false; // TODO: fallback for url if window isn't defined
	var BLOB_RESPONSE = supportsURL ? "blob" : "arraybuffer";

	var deferred = new defer();

	var xhr = new XMLHttpRequest();

	//-- Check from PDF.js:
	//   https://github.com/mozilla/pdf.js/blob/master/web/compatibility.js
	var xhrPrototype = XMLHttpRequest.prototype;

	var header;

	if (!("overrideMimeType" in xhrPrototype)) {
		// IE10 might have response, but not overrideMimeType
		Object.defineProperty(xhrPrototype, "overrideMimeType", {
			value: function xmlHttpRequestOverrideMimeType() {}
		});
	}

	if(withCredentials) {
		xhr.withCredentials = true;
	}

	xhr.onreadystatechange = handler;
	xhr.onerror = err;

	xhr.open("GET", url, true);

	for(header in headers) {
		xhr.setRequestHeader(header, headers[header]);
	}

	if(type == "json") {
		xhr.setRequestHeader("Accept", "application/json");
	}

	// If type isn"t set, determine it from the file extension
	if(!type) {
		type = new Path(url).extension;
	}

	if(type == "blob"){
		xhr.responseType = BLOB_RESPONSE;
	}


	if(isXml(type)) {
		// xhr.responseType = "document";
		xhr.overrideMimeType("text/xml"); // for OPF parsing
	}

	if(type == "xhtml") {
		// xhr.responseType = "document";
	}

	if(type == "html" || type == "htm") {
		// xhr.responseType = "document";
	}

	if(type == "binary") {
		xhr.responseType = "arraybuffer";
	}

	const isEncrypted = encryption && encryption.isFileEncrypted(url);
	if(isEncrypted){
		xhr.responseType = "arraybuffer";
	}

	xhr.send();
	
	function err(e) {
		deferred.reject(e);
	}

	function handler() {
		if (this.readyState === XMLHttpRequest.DONE) {
			var responseXML = false;

			if(this.responseType === "" || this.responseType === "document") {
				responseXML = this.responseXML;
			}

			if (this.status === 200 || this.status === 0 || responseXML) { //-- Firefox is reporting 0 for blob urls
				var r;

				if (!this.response && !responseXML) {
					deferred.reject({
						status: this.status,
						message : "Empty Response",
						stack : new Error().stack
					});
					return deferred.promise;
				}

				if (this.status === 403) {
					deferred.reject({
						status: this.status,
						response: this.response,
						message : "Forbidden",
						stack : new Error().stack
					});
					return deferred.promise;
				}
				let responseToParse = this.response;
				if(isEncrypted){
					const decrypted = encryption.decrypt( this.response);
					responseToParse = decrypted;
				}


				if(responseXML){
					r = this.responseXML;
				} else
				if(isXml(type)){
					// xhr.overrideMimeType("text/xml"); // for OPF parsing
					// If this.responseXML wasn't set, try to parse using a DOMParser from text
					r = parse(responseToParse, "text/xml");
				}else
				if(type == "xhtml"){
					r = parse(responseToParse, "application/xhtml+xml");
				}else
				if(type == "html" || type == "htm"){
					r = parse(responseToParse, "text/html");
				}else
				if(type == "json"){
					r = JSON.parse(responseToParse);
				}else
				if(type == "blob"){

					if(supportsURL) {
						r =responseToParse;
					} else {
						//-- Safari doesn't support responseType blob, so create a blob from arraybuffer
						r = new Blob([responseToParse]);
					}

				}else{
					r = responseToParse;
				}

				deferred.resolve(r);
			} else {

				deferred.reject({
					status: this.status,
					message : this.response,
					stack : new Error().stack
				});

			}
		}
	}

	return deferred.promise;
}

export default request;
