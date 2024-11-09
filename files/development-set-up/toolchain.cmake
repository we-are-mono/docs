set(PKG_CONFIG_EXECUTABLE "/usr/bin/aarch64-linux-gnu-pkg-config")

set(rootfs $ENV{CROSS_SYSROOT})
set(dpdk_src $ENV{DPDK_SRC})

set(CMAKE_SKIP_RPATH "TRUE")

set(CMAKE_CROSSCOMPILING "TRUE")
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)

set(CMAKE_SYSROOT ${rootfs})
set(CMAKE_C_COMPILER $ENV{CROSS_COMPILE}gcc)
set(CMAKE_CXX_COMPILER $ENV{CROSS_COMPILE}g++)
set(CMAKE_FIND_ROOT_PATH $ENV{CROSS_SYSROOT}/lib)

set(DPDK_INCLUDE_DIR ${rootfs}/usr)
set(DPDK_RTE_IBVERBS_LINK_DLOPEN "TRUE")
set(VPP_USE_SYSTEM_DPDK "ON")

# search for programs in the build host directories (not necessary)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)

# for libraries and headers in the target directories
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)

INCLUDE_DIRECTORIES("${rootfs}/usr/include/aarch64-linux-gnu")
INCLUDE_DIRECTORIES("${dpdk_src}/drivers/bus/vmbus")
INCLUDE_DIRECTORIES("${dpdk_src}/drivers/bus/pci")
INCLUDE_DIRECTORIES("${dpdk_src}/lib/eal/include")
INCLUDE_DIRECTORIES("${dpdk_src}/lib/cryptodev")

# set(THREADS_PTHREAD_ARG "2" CACHE STRING "Forcibly set by CMakeLists.txt." FORCE)
set(CMAKE_THREAD_LIBS_INIT "-lpthread")
set(CMAKE_HAVE_THREADS_LIBRARY 1)
set(CMAKE_USE_WIN32_THREADS_INIT 0)
set(CMAKE_USE_PTHREADS_INIT 1)
set(THREADS_PREFER_PTHREAD_FLAG ON)
