# pass-browser-chrome

pass-browser-chrome is a browser plugin for chrome/chromium that brings your secrets managed by `pass` to your browser. Read all about `pass` [here](http://www.passwordstore.org).

## How to use

If you have not installed a compatible server yet, you can just install one:

* [node-server](https://github.com/cpoppema/pass-server-node#installation) for a server written in JavaScript

For this setup to work, secrets must be stored in the format `url/username`, for example: `github.com/cpoppema`. You can still categorize secrets since the server assumes the filename is the username and the directory the secrets exists in is the url. Multiline secrets are no issue either since the browser plugin only recognized the first line of your secret as the password.

## How to install

Install the browser plugin by either:
- downloading pass-browser-chrome-{version}.crx directly from the [releases](releases) page
- building it yourself
    * clone this repository
    * run `npm install`
    * run `grunt`
    * install the extension from file build/pass-browser-chrome-{version}.crx

## How to give this extension access to your passwords

Since your secrets are decrypted directly in your browser, you will need to generate a keypair and import the public key on your server, this is easy.

After installing this browser plugin, open the plugin and go to Options. There you'll find a form that helps you create a keypair and save it in your browser. To import the public key, simply connect with your server and run these commands.

The only things required are that you already have `gpg` and `pass` installed.

Replace this sample key with the key that you just generated in the plugin options.

Run:
```Shell
echo "-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js VERSION
Comment: http://openpgpjs.org

xsBNBFaqcIoBCACzds3hAVbstW5fAu9BAGJ+UUVyshZmzOujO00vIPkOojpb
wHkC+wkISppLfCLCCikKJYfTo3vG+npw8X2LJr19WSK2zEUBl9JNlPaWHDSd
9M6I8jzpdj6rhSFl0e+IJPrYa471TVwBLu8J6JJOnOWxKA8Uz0tmVqZz+eip
+n5UqGufqdUlE5DaBV6YJ4y/Fxb2RglCD8hCnhCKtL7SkrUptlx/zDz4mwi0
q11AZpsMP9Zc7HFTUOoKq32eOqXn7DSAXVQuvs3WXFlZlq/iWXmTf0wuHiP9
HUPsSSqKpDsm/U/HtEBWIDaO97TsZR68eSPDYfuAhCdnGSzKq7ODamYhABEB
AAHNFXBhc3MtZXh0ZW5zaW9uLWNocm9tZcLAcgQQAQgAJgUCVqpwigYLCQgH
AwIJEKagQXZa+GY+BBUIAgoDFgIBAhsDAh4BAABNNgf/dQKq4+CuHjSyiiGl
Jzd93GfGTm4GT35QTsJuYQH6yOFqCnN/3QuevZ3tvjNeo09aCqW8YC1wkZRY
Ie6+fWeEMGNCJUE02TQhoaFceaRBuvx1rYI9Y2a20SNKQOCXJx8wGbjuXndg
6Kk3M3NrGdkrIwAQZ5O76GaGInK9Luc9W8Y06Rm4ndqeHhF5/fHYfkeM/KHp
d/nAuptwVN+dm3fo/zY4dxtKvBQuEDLqdYeLNmLi114BRKVpkf4K94JQ13Lc
K9YRZU9ldWScmKn3Edci6zj3qta7EqXyl0RjTrszkrg+XRIpp9q+p9ZY7jTc
xySSKInmeluLvN0EFCSymXEv787ATQRWqnCKAQgAzImvSxgslFZzID+qWp8z
VGDtbKCegGcNDUe3UbCOliNB9SsslO2f3rRUy7kO37M4VKobVleMLv6ViW7G
a8d74uoCNooBV4HibWNGBVESNhhvsj0tEvjkg+BEmKeOt5BDy6wrvzfu0rfz
iz0DE0zGgj2yaOs08ku7Y/+qrxkA2N1YVfzs+zzX4ShxsITXViQzwRTaN2kw
2OFvbouyqv557QJYfGk8TqmQSO3Kd2Y2GWzVyOU07WBEJxIw+CHvVdh4vwmB
5ZS7ED3TT063m4X7H36QtbadKqLUEk2Ty6zu88O2gTBGaPw6csNo5NVGgIUx
O8PS1olm+XRFwSXocCj5eQARAQABwsBfBBgBCAATBQJWqnCLCRCmoEF2Wvhm
PgIbDAAA+KgH/ikoWOs5B3eS64jCzCyaH6bjKS9hEFt9NyLIi7UtYT6Z47R7
aUP5wUFluV7KYZknafvRi4eTUTVZrf8s0uijc8Mg/meem1iyNVbsvBt3hAIO
zlrjbW8+SuOWr4aNZKTFwMd3Udm146w5++7jwOmAXHT3oXkHZHTxpI3/63LA
8cFxf0j3KQTDyanUnUThXod1mWgvvM4sVsrzeHIdXrcBqBBI3rjZGFr8qq6u
Go6GqViRD01jmnVK8ysd8kyYKQPzKh61DiiwJkERbU7w6in8r483QliQdKH/
2U8vn3od1pZI8RoEppnmq0rAzLkSUCDIK0lLURV9G0JNbD1/7QnShd0=
=uttU
-----END PGP PUBLIC KEY BLOCK-----" | gpg --import -
```

You will see something like this, all you need to remember is one thing from this output: the key ID. The ID here is `5AF8663E`. You can also user the longer key ID you can find in the plugin options. In this example it would be A6A041765AF8663E.

```Shell
gpg: /home/me/.gnupg/trustdb.gpg: trustdb created
gpg: key 5AF8663E: public key "pass-extension-chrome" imported
gpg: Total number processed: 1
gpg:               imported: 1  (RSA: 1)
```

All that is left is to:

* sign your imported key
* tell `pass` to allow this key to access your secrets

**Sign your imported key**

To tell `gpg` you trust this source you're required to sign this key before it is of any use.

Run
```Shell
gpg --sign-key 5AF8663E
```

Signing requires an existing keypair on your server. A keypair is also required for `pass` to add new secrets.

**Tell pass to allow this key**

All that is left is to tell `pass` to encrypt your secrets using this public key so the browser plugin can decrypt it on your computer.

```Shell
pass init {KEY ID 1} {KEY ID 2}
```

So let's say your existing keypair's ID is AF3D26E5, run
```Shell
pass init AF3D26E5 5AF8663E
```

The output might look something like this if you've only setup `pass` just now:

```Shell
mkdir: created directory ‘/home/me/.password-store/’
Password store initialized for AF3D26E5, 5AF8663E
```

Or if you already had a password store, it probably looks more like this:

```Shell
Password store initialized for AF3D26E5, 5AF8663E
github.com/cpoppema: reencrypting to 088BAD9F22BD2048 15EF6677CC78CF01
```

**Credits**

* [salsita](https://github.com/salsita/chrome-extension-skeleton) for providing a chrome extension skeleton
* [openpgpjs](https://github.com/openpgpjs/openpgpjs) for bringing openpgp to JavaScript in an easy-to-use way
* [Jason](http://www.zx2c4.com/) for writing `pass`
