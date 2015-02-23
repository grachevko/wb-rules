package wbrules

import (
	"testing"
	"github.com/stretchr/testify/assert"
//        wbgo "github.com/contactless/wbgo"
)

type ruleFixture struct {
	cellFixture
	engine *RuleEngine
}

func NewRuleFixture(t *testing.T) *ruleFixture {
	fixture := &ruleFixture{*NewCellFixture(t), nil}
	fixture.engine = NewRuleEngine(fixture.model)
	fixture.engine.SetLogFunc(func (message string) {
		fixture.broker.Rec("[rule] %s", message)
	})
	assert.Equal(t, nil, fixture.engine.LoadScript("testrules.js"))
	fixture.driver.Start()
	fixture.publish("/devices/somedev/meta/name", "SomeDev", "")
	fixture.publish("/devices/somedev/controls/sw/meta/type", "switch", "sw")
	fixture.publish("/devices/somedev/controls/sw", "0", "sw")
	fixture.publish("/devices/somedev/controls/temp/meta/type", "temperature", "temp")
	fixture.publish("/devices/somedev/controls/temp", "19", "temp")
	return fixture
}

func (fixture *ruleFixture) Verify(logs... string) {
	fixture.broker.Verify(logs...)
}

func TestDeviceDefinition(t *testing.T) {
	fixture := NewRuleFixture(t)
	defer fixture.tearDown()
	fixture.Verify(
		"driver -> /devices/stabSettings/meta/name: [Stabilization Settings] (QoS 1, retained)",
		"driver -> /devices/stabSettings/controls/enabled/meta/type: [switch] (QoS 1, retained)",
		"driver -> /devices/stabSettings/controls/enabled/meta/order: [1] (QoS 1, retained)",
		"driver -> /devices/stabSettings/controls/enabled: [0] (QoS 1, retained)",
		"Subscribe -- driver: /devices/stabSettings/controls/enabled/on",
		"driver -> /devices/stabSettings/controls/highThreshold/meta/type: [temperature] (QoS 1, retained)",
		"driver -> /devices/stabSettings/controls/highThreshold/meta/order: [2] (QoS 1, retained)",
		"driver -> /devices/stabSettings/controls/highThreshold: [22] (QoS 1, retained)",
		"Subscribe -- driver: /devices/stabSettings/controls/highThreshold/on",
		"driver -> /devices/stabSettings/controls/lowThreshold/meta/type: [temperature] (QoS 1, retained)",
		"driver -> /devices/stabSettings/controls/lowThreshold/meta/order: [3] (QoS 1, retained)",
		"driver -> /devices/stabSettings/controls/lowThreshold: [20] (QoS 1, retained)",
		"Subscribe -- driver: /devices/stabSettings/controls/lowThreshold/on",
		"Subscribe -- driver: /devices/+/meta/name",
		"Subscribe -- driver: /devices/+/controls/+",
		"Subscribe -- driver: /devices/+/controls/+/meta/type",
		"tst -> /devices/somedev/meta/name: [SomeDev] (QoS 1, retained)",
		"tst -> /devices/somedev/controls/sw/meta/type: [switch] (QoS 1, retained)",
		"tst -> /devices/somedev/controls/sw: [0] (QoS 1, retained)",
		"tst -> /devices/somedev/controls/temp/meta/type: [temperature] (QoS 1, retained)",
		"tst -> /devices/somedev/controls/temp: [19] (QoS 1, retained)",
	)
}

func TestRules(t *testing.T) {
	fixture := NewRuleFixture(t)
	defer fixture.tearDown()
	fixture.broker.Reset()
	fixture.model.EnsureDevice("stabSettings").EnsureCell("enabled").SetValue(true)
	fixture.engine.RunRules()
	fixture.Verify(
		"driver -> /devices/stabSettings/controls/enabled: [1] (QoS 1, retained)",
		"[rule] heaterOn fired",
 		"driver -> /devices/somedev/controls/sw/on: [1] (QoS 1)",
	)
}

// TBD: proper data path:
// http://stackoverflow.com/questions/18537257/golang-how-to-get-the-directory-of-the-currently-running-file
// https://github.com/kardianos/osext
// TBD: test bad device/rule defs
// TBD: traceback
// TBD: if rule *did* change anything (SetValue had an effect), re-run rules
//      and do so till no values are changed
