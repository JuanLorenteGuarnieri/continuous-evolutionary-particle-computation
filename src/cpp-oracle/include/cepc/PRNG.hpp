#pragma once
#include <cstdint>

namespace cepc {
class XorShift32 {
public:
    explicit XorShift32(uint32_t seed = 1) : state(seed ? seed : 1) {}
    uint32_t nextUInt() {
        uint32_t x = state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        state = x;
        return state;
    }
    double nextFloat() {
        return static_cast<double>(nextUInt()) / static_cast<double>(UINT32_MAX);
    }
    uint32_t getState() const { return state; }
    void setState(uint32_t s) { state = s; }
private:
    uint32_t state;
};
}
