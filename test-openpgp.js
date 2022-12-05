const openpgp = require('openpgp'); // use as CommonJS, AMD, ES6 module or via window.openpgp
// import { readKey } from 'openpgp';


(async () => {
    // put keys in backtick (``) to avoid errors caused by spaces or tabs
    const publicKeyArmored = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js VERSION
Comment: http://openpgpjs.org

xsBNBFb0KZoBCADTagK4uBEC072IGPAQVgxGT9Gt0edYy6qwWQr3H9NZXtvK
eTl9R2J3iFEBmfHWAc+X51lp9rYkS14NinHnTI6C+epTsXk4auGLX+u5eJsN
Dxq2GIGS2W2LEgr3oXKrWRikZhR4cNnkZnAjzyb4eFRniLGn+EJATik1EfB4
luGUNYpGbmni0ZNRif1bZf8k7P9m1Q/3w/Ev38ju4SrL8cKv4JuiQFzBVR4v
7iDQwQQC0kXUhxTaW0BrKkZ1iI6ro1Q6LlaotRWENq66vXA+1K1JwDarjpdU
EGzOa37TsFyuaw9wqKKzEl8gNDkYhEmUI73drnew7piB+f0RzA1Pvgj1ABEB
AAHNJXBhc3MtZXh0ZW5zaW9uLWNocm9tZSB3b3Jrc3RhdGlvbjJrMTXCwHIE
EAEIACYFAlb0KZoGCwkIBwMCCRBQqYlckX4tPQQVCAIKAxYCAQIbAwIeAQAA
WtgH/iyJjFDXPz+wHkgKFxNs1p+5cwVm6ZVVEobLPbtjEOe+MMrVewAYoaZR
3DVMzQg0/CI1dBk51gleTVascaC5pr40ZVYg0vJyHvwMg+Kgk2xiq6thVir0
lVzyl8VUXI27KO0PHt52IQZx+enlaOzu8xmrsyoUnJQtVy47110/3t3o99YO
GbENl+7/ElcN/B8vB1QR/9FuUGBAqFHHp4QRn1COljrk6tUTa6zWvXllRub5
+OQjGnKPdV4pM8SWLb0X4dpjhZXd7FOj2NkIdcX/7jb0SGEdPNRunb5Ch6uD
4Mi4xLFwdQqgyoZQ3gchUtuZcYpjtRQr5dkYwC+EjqWKhTXOwE0EVvQpmgEI
AMr2z57iUBPnrNuFphfirf2Va/lY3d1zDYto8AG7zgWS//8Jb/CePBGk99vE
JhrH483sevTjqKvdxRE13yWLGx8H6l7iJYXyZNPsRgST8lJxw/74MlMUHUuN
z5EP9/k8HqWo9SAsFRZUc1IMIvDpDya3WmEMnsBT4G4dZYV/T1wlMjsvyhfm
u51HqwKOohv8QPMLdNJ0zmB1BJ88zCqyHKitdC7YLT6JTCQ9JboQZjlzUQ/L
M/oG2PAviX5UlNawJJO6qg/SVbv+v4sMKPhvFK99DAhChy+km12V1+o4/kHA
CGNhsfdOAQi7WJrzsUNK/ToOFvVE3Aibi+nedX7PCgkAEQEAAcLAXwQYAQgA
EwUCVvQpmgkQUKmJXJF+LT0CGwwAAFaSB/0aB77Cix/vNJmovje16ewLltO8
nN7vQKKoERlnMoK9zkH7LlXmlTeyAbWCOK1V6EnR9/SDitBAdeQV3vTm3i/6
rG7nUXsyT6pEuo4FEF1+RWo8jW8h/ElEXDD91v8hbkW8EHW4MxoH9jIk4B3C
A0saQpFVbzYlS4tMUvDPGLh2ay4MVEuCsx/o/4FRKDFU+MBUBX9ObW8kH2PP
AZwZRoqa/VOee0gktHpei/CERxDNgifemd28qOK1QJth9ul5epSnbdQDzk48
jv00tf3gTSBBYiFy2ZGDVe1u6ryfn29f+TLW4m0+OhrMOjKwmuhkn23ddC0E
7aAszUgnVUGXq8KB
=w0Ck
-----END PGP PUBLIC KEY BLOCK-----

`;
    const privateKeyArmored = `-----BEGIN PGP PRIVATE KEY BLOCK-----
Version: OpenPGP.js VERSION
Comment: http://openpgpjs.org

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
oCzNSCdVQZerwoE=
=4ev7
-----END PGP PRIVATE KEY BLOCK-----`; // encrypted private key
    const passphrase = `1596523320`; // what the private key is encrypted with

    var encrypted = `-----BEGIN PGP MESSAGE-----

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
=FFOn
-----END PGP MESSAGE-----`

    // openpgp.decryptKey({
    //     privateKey: openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
    //     passphrase: '1234',
    // }).then(function success(text) {
    //     console.log(text);
    // });
    // console.log(privateKey);

    // var privateKeyArmored = await openpgp.readPrivateKey({armoredKey: items.privateKey});
    // console.log(privateKeyArmored);

    // await readKey({ armoredKey: publicKeyArmored }).then(function(publicKey) {
    //     var keyId = publicKey.keyPacket.keyID.toHex().toUpperCase();
    //     console.info(keyId);
    // });
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
    // console.log(publicKey);
    console.log(publicKey.keyPacket.keyID.toHex().toUpperCase());
    console.log(publicKey.users[0].userID.userID);

    // var keyId = publicKey.primaryKey.getKeyId().toHex().toUpperCase();
    // console.log(keyId);

    const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
        passphrase
    });

    // encrypted = await openpgp.encrypt({
    //     message: await openpgp.createMessage({ text: 'Hello, World!' }), // input as Message object
    //     encryptionKeys: publicKey,
    //     // signingKeys: privateKey // optional
    // });
    console.log(encrypted); // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'

    openpgp.config.allowUnauthenticatedMessages = true;

    const message = await openpgp.readMessage({
        armoredMessage: encrypted // parse armored message
    });
    const { data: decrypted, signatures } = await openpgp.decrypt({
        message: message,
        // verificationKeys: publicKey, // optional
        decryptionKeys: privateKey
    });
    console.log(decrypted); // 'Hello, World!'
    // // check signature validity (signed messages only)
    // try {
    //     await signatures[0].verified; // throws on invalid signature
    //     console.log('Signature is valid');
    // } catch (e) {
    //     throw new Error('Signature could not be verified: ' + e.message);
    // }
})();
