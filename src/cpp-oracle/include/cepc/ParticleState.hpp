#pragma once
#include "types.hpp"
#include <set>
#include <string>

namespace cepc {
struct ParticleState {
    std::string version = "3.0.0";
    Vec2 position{0,0};
    Vec2 velocity{0,0};
    double health = 0.0;
    int charge = 0;
    std::set<ParticleID> senderSet;
    std::set<ParticleID> prevSenderSet;

    bool isValid(double Qmax = 1e9, double Hmax = 1e9) const;
};
}
