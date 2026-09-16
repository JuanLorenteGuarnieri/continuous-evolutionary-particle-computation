cmake_minimum_required(VERSION 3.20)
project(cpp-oracle LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(cepc_oracle INTERFACE)
target_compile_features(cepc_oracle INTERFACE cxx_std_20)

# Tests
include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
)
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

enable_testing()
add_executable(test_main tests/test_main.cpp)
target_link_libraries(test_main PRIVATE gtest_main)
add_test(NAME cpp_oracle_tests COMMAND test_main)
