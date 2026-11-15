// Command hibi-sign makes and uses hibi.app's release signing key (Ed25519,
// base64).
//
//	hibi-sign keygen [-o key]   write a new private key (0600), print the public key
//	hibi-sign sign [-k key] f   print the signature of file f
//	hibi-sign verify f sigfile  check f against the public key compiled into the app
//
// sign reads the key from $HIBI_UPDATE_PRIVATE_KEY when set (CI), else from
// the key file. The default key file is ~/.config/hibi/update.key.
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/shcherbyakdev/hibi/desktop/update"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "hibi-sign:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: hibi-sign keygen [-o key] | sign [-k key] <file> | verify <file> <sigfile>")
	}
	home, _ := os.UserHomeDir()
	def := filepath.Join(home, ".config", "hibi", "update.key")
	fl := flag.NewFlagSet(args[0], flag.ContinueOnError)
	switch args[0] {
	case "keygen":
		out := fl.String("o", def, "private key file to create")
		if err := fl.Parse(args[1:]); err != nil {
			return err
		}
		pub, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(*out), 0o700); err != nil {
			return err
		}
		f, err := os.OpenFile(*out, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600) // never overwrite a key
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintln(f, base64.StdEncoding.EncodeToString(priv)); err != nil {
			f.Close()
			return err
		}
		if err := f.Close(); err != nil {
			return err
		}
		fmt.Println(base64.StdEncoding.EncodeToString(pub))
		return nil
	case "sign":
		keyFile := fl.String("k", def, "private key file")
		if err := fl.Parse(args[1:]); err != nil {
			return err
		}
		if fl.NArg() != 1 {
			return errors.New("usage: hibi-sign sign [-k key] <file>")
		}
		key := os.Getenv("HIBI_UPDATE_PRIVATE_KEY")
		if key == "" {
			b, err := os.ReadFile(*keyFile)
			if err != nil {
				return err
			}
			key = string(b)
		}
		priv, err := base64.StdEncoding.DecodeString(strings.TrimSpace(key))
		if err != nil || len(priv) != ed25519.PrivateKeySize {
			return errors.New("the private key isn't a base64 Ed25519 key")
		}
		data, err := os.ReadFile(fl.Arg(0))
		if err != nil {
			return err
		}
		fmt.Println(base64.StdEncoding.EncodeToString(ed25519.Sign(ed25519.PrivateKey(priv), data)))
		return nil
	case "verify":
		if len(args) != 3 {
			return errors.New("usage: hibi-sign verify <file> <sigfile>")
		}
		pub := update.PublicKey()
		if pub == nil {
			return errors.New("desktop/update/pubkey.txt has no key")
		}
		data, err := os.ReadFile(args[1])
		if err != nil {
			return err
		}
		sigB64, err := os.ReadFile(args[2])
		if err != nil {
			return err
		}
		sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(sigB64)))
		if err != nil || !ed25519.Verify(pub, data, sig) {
			return errors.New("signature does NOT match the compiled-in public key")
		}
		fmt.Println("signature OK")
		return nil
	}
	return fmt.Errorf("unknown command %q", args[0])
}
