import {md, cipher, util} from "node-forge";
import {qs, qsa} from "./utils/core";

const AES_BLOCK_SIZE = 16;
const ENCRYPTION_ALGORITHM = "http://www.w3.org/2001/04/xmlenc#aes256-cbc";

class Encryption {
	constructor(userPassphrase) {
		this.userPassphrase = userPassphrase;
		this.contentKey = undefined;
		this.encryptedFiles = undefined;
	}

	readEncryption(encryptionXml, resolvePath) {
		const nodes = qsa(encryptionXml, "EncryptedData");
		this.encryptedFiles = new Set();

		// use regular for loop to support rn webview
		for (let i = 0; i < nodes.length; i += 1) {
			const node = nodes[i];
			// can't use querySelector to support rn webview
			var encryptionAlgorithm = qs(node, "EncryptionMethod").getAttribute("Algorithm");
			if (encryptionAlgorithm === ENCRYPTION_ALGORITHM) {
				var filePath = qs(node, "CipherReference").getAttribute("URI");
				this.encryptedFiles.add(resolvePath(filePath));
			}
		}
	}

	decryptContentKey(encryptedContentKey) {
		if (!this.userPassphrase) {
			return;
		}
		const sha256 = md.sha256.create();
		sha256.update(this.userPassphrase, "utf8");
		const digest = sha256.digest();
		const userKey = digest.bytes();

		const contentKeyByteArr = util.decode64(encryptedContentKey);
		const iv = contentKeyByteArr.slice(0, AES_BLOCK_SIZE);
		const encrypted = contentKeyByteArr.slice(AES_BLOCK_SIZE);
		const decipher = cipher.createDecipher("AES-CBC", userKey);
		decipher.start({iv: iv, additionalData_: "binary-encoded string"});
		decipher.update(util.createBuffer(encrypted));
		decipher.finish();
		const contentKey = util.encode64(decipher.output.bytes());
		this.contentKey = contentKey;
	}

	decrypt(data) {
		if (!this.contentKey) {
			return "";
		}

		const decipher = cipher.createDecipher("AES-CBC", util.decode64(this.contentKey));
		const encryptedBuffer = util.createBuffer(data);
		const iv = encryptedBuffer.getBytes(AES_BLOCK_SIZE);
		decipher.start({iv: iv});
		decipher.update(encryptedBuffer);
		const result = decipher.finish();
		const output = decipher.output;
		return util.decodeUtf8(output.bytes());
	}

	isFileEncrypted(path) {
		return this.encryptedFiles && this.encryptedFiles.has(path);
	}

	destroy() {
		this.userPassphrase = undefined;
		this.contentKey = undefined;
		this.encryptedFiles = undefined;
	}
}

export default Encryption;
