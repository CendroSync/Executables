use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EncryptedPayload {
    pub protocol_version: String,
    pub message_id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub timestamp: i64,
    pub nonce: String,
    pub payload: String,
    pub tag: String,
    pub signature: String,
}

pub fn sanitize_text(text: &str) -> String {
    text.chars()
        .filter(|&c| {
            let u = c as u32;
            !(u <= 0x08 || u == 0x0B || u == 0x0C || (0x0E..=0x1F).contains(&u) || (0x7F..=0x9F).contains(&u))
        })
        .collect()
}

pub struct CryptoEngine {
    key: [u8; 32],
}

impl CryptoEngine {
    pub fn new(raw_key: &[u8; 32]) -> Self {
        Self { key: *raw_key }
    }

    pub fn encrypt(&self, plaintext: &str, sender_id: &str, sender_name: &str) -> Result<EncryptedPayload, String> {
        let clean_text = sanitize_text(plaintext);
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| format!("Failed to create cipher: {}", e))?;

        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext_with_tag = cipher
            .encrypt(nonce, clean_text.as_bytes())
            .map_err(|e| format!("Encryption error: {}", e))?;

        let (ciphertext, tag_bytes) = ciphertext_with_tag.split_at(ciphertext_with_tag.len() - 16);

        let timestamp = chrono_lite_now();
        let message_id = Uuid::new_v4().to_string();

        Ok(EncryptedPayload {
            protocol_version: "1.0".to_string(),
            message_id,
            sender_id: sender_id.to_string(),
            sender_name: sender_name.to_string(),
            timestamp,
            nonce: BASE64.encode(nonce_bytes),
            payload: BASE64.encode(ciphertext),
            tag: BASE64.encode(tag_bytes),
            signature: "rsa_signature_placeholder".to_string(),
        })
    }

    pub fn decrypt(&self, payload: &EncryptedPayload) -> Result<String, String> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| format!("Failed to create cipher: {}", e))?;

        let nonce_bytes = BASE64
            .decode(&payload.nonce)
            .map_err(|e| format!("Invalid nonce base64: {}", e))?;
        let ciphertext_bytes = BASE64
            .decode(&payload.payload)
            .map_err(|e| format!("Invalid payload base64: {}", e))?;
        let tag_bytes = BASE64
            .decode(&payload.tag)
            .map_err(|e| format!("Invalid tag base64: {}", e))?;

        let nonce = Nonce::from_slice(&nonce_bytes);

        let mut combined = ciphertext_bytes;
        combined.extend_from_slice(&tag_bytes);

        let plaintext_bytes = cipher
            .decrypt(nonce, combined.as_ref())
            .map_err(|e| format!("Decryption authentication failed: {}", e))?;

        let text = String::from_utf8_lossy(&plaintext_bytes).to_string();
        Ok(sanitize_text(&text))
    }
}

fn chrono_lite_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
