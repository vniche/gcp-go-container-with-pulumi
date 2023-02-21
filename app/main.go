package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
)

func readSecret(w http.ResponseWriter, r *http.Request) (string, error) {
	path, ok := os.LookupEnv("SECRET_PATH")
	if !ok {
		return "", fmt.Errorf("SECRET_PATH is required")
	}

	secret, err := ioutil.ReadFile(path)
	if err != nil {
		return "", err
	}

	return string(secret), nil
}

func main() {
	e := echo.New()
	e.GET("/", func(c echo.Context) error {
		secret, err := readSecret(c.Response().Writer, c.Request())
		if err != nil {
			fmt.Printf("unable to read secret: %v\n", err)
			return c.String(http.StatusInternalServerError, "something went wrong")
		}

		return c.String(http.StatusOK, fmt.Sprintf("this is my secret: %s\n", secret))
	})
	e.Logger.Fatal(e.Start(":1323"))
}
