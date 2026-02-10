package runner

import "fmt"

type Language struct {
	ID          int
	Name        string
	Interpreter string
	Extension   string
}

var languages = map[int]Language{
	71: {ID: 71, Name: "Python", Interpreter: "/usr/bin/python3", Extension: ".py"},
	63: {ID: 63, Name: "JavaScript", Interpreter: "/usr/bin/node", Extension: ".js"},
}

func GetLanguage(id int) (Language, error) {
	lang, ok := languages[id]
	if !ok {
		return Language{}, fmt.Errorf("unsupported language_id: %d", id)
	}
	return lang, nil
}

func SupportedLanguageIDs() []int {
	ids := make([]int, 0, len(languages))
	for id := range languages {
		ids = append(ids, id)
	}
	return ids
}
