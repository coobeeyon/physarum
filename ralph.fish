#!/usr/bin/env fish

set schema '{"type":"object","properties":{"done":{"type":"boolean"}},"required":["done"]}'
set prompt "If there are no more beads under i08 then just set done=true then exit. Otherwise implement a task under i08 and then set done=false and exit."

set i 0
while true
    set i (math $i + 1)
    echo "=== iteration $i ==="
    test $i -gt 10; and echo "max iterations reached"; and break
    set result (claude -p "$prompt" --output-format json --json-schema "$schema" | jq -r .structured_output.done)
    echo "done=$result"
    test "$result" = "true"; and break
end
