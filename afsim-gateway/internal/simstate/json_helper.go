package simstate

import "encoding/json"

// jsonMarshal is a convenience wrapper used by custom MarshalJSON methods
// in this package to avoid import cycles with encoding/json.
func jsonMarshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}
