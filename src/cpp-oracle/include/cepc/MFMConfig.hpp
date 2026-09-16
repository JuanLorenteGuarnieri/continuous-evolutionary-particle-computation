#pragma once
#include <string>

namespace cepc {
struct MFMConfig {
    std::string version = "3.0.0";
    double Lx = 100.0;
    double Ly = 100.0;
    int Nmax = 1000;
    double dt = 0.1;
    unsigned int seed = 0;
    int Qmax = 1000;
    double R_s_min = 0.5;
    double R_s_max = 5.0;

    bool isValid() const;
};
}
