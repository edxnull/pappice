import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const opensslConfig = `[req]
prompt = no
distinguished_name = subject
x509_extensions = extensions

[subject]
CN = 127.0.0.1

[extensions]
subjectAltName = @alt_names

[alt_names]
IP.1 = 127.0.0.1
DNS.1 = localhost
`;

async function generateCertificate(certPath, keyPath) {
  const configPath = path.join(path.dirname(certPath), "openssl.cnf");
  await writeFile(configPath, opensslConfig, { mode: 0o600 });
  await runOpenSSL([
    "req",
    "-x509",
    "-newkey", "rsa:2048",
    "-nodes",
    "-keyout", keyPath,
    "-out", certPath,
    "-days", "1",
    "-config", configPath
  ]);
}

function runOpenSSL(args) {
  return new Promise((resolvePromise, reject) => {
    execFile("openssl", args, (error, _stdout, stderr) => {
      if (!error) {
        resolvePromise();
        return;
      }
      reject(new Error(`openssl failed: ${stderr.trim() || error.message}`, { cause: error }));
    });
  });
}

export { generateCertificate };
