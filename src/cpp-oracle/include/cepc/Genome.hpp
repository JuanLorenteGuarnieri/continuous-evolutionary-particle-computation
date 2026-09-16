#pragma once
#include <string>

namespace cepc {
struct Genome {
    std::string version = "3.0.0";
    double H_max = 100.0;
    double theta_q = 1.0;
    double A = 1.0;
    int K = 1;
    double R_c = 1.0;
    double m = 1.0;
    double gamma = 0.1;
    double R_s = 1.0;
    double omega_R = 0.0;
    double omega_A = 0.0;
    double omega_v = 0.0;

    bool isValid() const;
};
}
