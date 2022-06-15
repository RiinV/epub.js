
import {md, cipher, util} from "node-forge";
const AES_BLOCK_SIZE = 16;
const ENCRYPTION_ALGORITHM = "http://www.w3.org/2001/04/xmlenc#aes256-cbc";

class Encryption {
	constructor(userPassphrase) {
		this.userPassphrase = userPassphrase;
		this.contentKey = undefined;
		this.encryptedFiles = undefined;
	}

	readEncryption(encryptionXml, resolvePath){
		const nodes = encryptionXml.getElementsByTagName("EncryptedData");
		this.encryptedFiles = new Set();
		for (let node of nodes) {
			const encryptionAlgorithm = node.querySelector("EncryptionMethod").getAttribute("Algorithm");
			if(encryptionAlgorithm === ENCRYPTION_ALGORITHM){
				const filePath = node.querySelector("CipherReference").getAttribute("URI");	
				const newPath = filePath.split('/').slice(1).join('/'); //Todo: add proper path handling
				this.encryptedFiles.add(resolvePath(newPath));
			}
		}
	}

	readLicense(licence){
		
	}

	decryptContentKey(encryptedContentKey){
		if(!this.userPassphrase){
			return;
		}
		const sha256 = md.sha256.create();
		sha256.update(this.userPassphrase, "utf8");
		const digest = sha256.digest();
		const userKey = digest.bytes();

		const contentKeyByteArr = util.decode64(encryptedContentKey);
		const iv = contentKeyByteArr.slice(0, AES_BLOCK_SIZE);
		const encrypted = contentKeyByteArr.slice(AES_BLOCK_SIZE);
		const decipher = cipher.createDecipher('AES-CBC', userKey);
		decipher.start({iv: iv, additionalData_: "binary-encoded string"});
		decipher.update(util.createBuffer(encrypted));
		decipher.finish();
		const contentKey = util.encode64(decipher.output.bytes());
		this.contentKey = contentKey;
	}

	decrypt(data){
		if(!this.contentKey){
			return "";
		}
		const decipher = cipher.createDecipher('AES-CBC', util.decode64(this.contentKey));
		const encryptedBuffer = util.createBuffer(data);
		const iv = encryptedBuffer.getBytes(AES_BLOCK_SIZE);
		decipher.start({iv: iv});
		decipher.update(encryptedBuffer);
		const result = decipher.finish();
		const output = decipher.output;
		return output.data;
	}

	isFileEncrypted(path){
		return this.encryptedFiles && this.encryptedFiles.has(path);
	}

	destroy() {
		this.userPassphrase = undefined;
		this.contentKey = undefined;
		this.encryptedFiles = undefined;
	}
}

export default Encryption;
