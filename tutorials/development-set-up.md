# LS1046A development environment setup

In this article, we're going to set up a Debian 12 (bookworm) machine for developing software for [NXP LS1046A CPUs](https://www.nxp.com/products/processors-and-microcontrollers/arm-processors/layerscape-processors/layerscape-1046a-and-1026a-processors:LS1046A). We're using a virtual machine for this purposes, but a normal, physical box should work just the same.

The goal here is to build two pieces of software that allow us to achieve *insane* amounts of networking performance on our 10 Gigabit ports regardless of what kind of traffic is passing through them or what kind of processing we need to do on it - NAT (IPv4 or IPv6), VLANs, PPPoE, IPSEC, IPS/IDS, you name it. And the software that allows us to do that is called Vector Packet Processing. Traditionally, kernel handles layers 2-4 in the OSI networking model, but since it's very inefficient at doing so, we're preventing it from even accessing the NICs in the first place. Instead, layer 2 is handled by something called a [Data Plane Development Kit (DPDK)](https://www.dpdk.org/) and layers 3 and 4 are handled by [VPP](https://fd.io/), which in turn depends on DPDK and will not work properly without it. Building both is a relatively complex and involved process, which is where this article comes in. Hopefully, by the end, you should have an understanding of how to cross-build both for arm64 and have them running on a development board!

---

We're going to cross-compile a whole lot of packages, and to that end, we're going to create and mount a "target" filesystem on the same Linux machine we're working on, and this target filesystem can then be mounted on the development board at boot time (through NFS) or turned into an SD card which we can then boot into.

Keep in mind that this is **not** a production-ready environment, but instead will result in having a development/debugging environment that we can then use for further development of software that will then be used in production.

One additional thing worth mentionig is the nomenclature we're going to use, *host* and *target* specifically, because we'll use these two words a lot. *Host* refers to your development machine which is most likely an x86-based Linux PC. We'll *cross-compile* software that will be unable to run on it, because it will be built for our *target*, which is the development board, and that board runs a CPU on arm64 architecture.

> [!NOTE]
> For the time being, this article is written to work with the [NXP LS1046A Reference Design Board](https://www.nxp.com/design/design-center/software/qoriq-developer-resources/layerscape-ls1046a-reference-design-board:LS1046A-RDB) but will be rewritten to work with our router once the evaluation boards are out. That being said, with some modifications, it should also work with other ARM64-based boards!

Since we're working on the software, that is in many cases system-wide, both on the host and even more so on the target root filesystem, we're going to use the *root* user to run all the commands below, so just swap to it by entering `$ sudo -i`.

We're also going to use `/usr/src` as our working directory and it's here where we will download and build all the packages, so once you're logged into the (virutal) machine, `$ cd /usr/src` and let's begin!


## Prerequisites

Before we can start, we need to make sure that we have all the necessary packages installed:

`$ apt install -y debootstrap qemu-user-static qemu-utils  parted kpartx build-essential make cmake ncurses-dev flex bison meson bc vim curl git pkg-config rsync nfs-kernel-server debootstrap debhelper dh-python python3-pyelftools python3-ply chrpath tftpd-hpa htop`


We also need a cross-compiler, and for that, we'll use the one that [Linaro](https://www.linaro.org/) provides and are one of the most popular cross-compilers for ARM.

```shell
$ cd /opt
$ wget https://snapshots.linaro.org/gnu-toolchain/12.3-2023.06-1/aarch64-linux-gnu/gcc-linaro-12.3.1-2023.06-x86_64_aarch64-linux-gnu.tar.xz
$ tar -xf gcc-linaro-12.3.1-2023.06-x86_64_aarch64-linux-gnu.tar.xz
$ ln -sf gcc-linaro-12.3.1-2023.06-x86_64_aarch64-linux-gnu toolchain
```


## Build the kernel

We didn't install OpenSSL as part of the initial package installation, because we want to use the same version for both, to build the target kernel as well as use it on the target system as well (because many networking packages we're about to build depend on it). So let's download a fresh copy from GitHub and build it for the host environment first:

```shell
$ cd /usr/src
$ git clone https://github.com/openssl/openssl.git
$ cd openssl
$ git checkout openssl-3.4.0
$ ./Configure
$ make -j8
$ make install
```

> [!NOTE]
In case OpenSSL returns errors, chances are, you have already set `ARCH` and `CROSS_COMPILE` environment variables (below) so it's trying to build for Arm achitecture! In this case, just unset both by entering `$ unset ARCH CROSS_COMPILE` and then run the `./Configure` again.


At this point, you also need to add some additional environment variables to the bottom of either `.bashrc` or `.zshrc` so that we don't need to add them to each command:

```shell
export ARCH=arm64
export PATH=$PATH:/opt/toolchain/bin
export CROSS_COMPILE=aarch64-linux-gnu-
```

Don't forget to run `$ source ~/.bashrc` to load those new environment variables!

---

Now we're ready to build the kernel. Since we're using a Layerscape CPU, we won't be using the official kernel but instead the one that NXP provides and includes the necessary packages that take advantage of their DPAA architecture. Unlike with other packages, we're going to use a branch that's a little older, because the `lf-6.6.36-2.1.0` version contains a bug that causes some memory issues. They also provide a default configuration that should work with all their hardware out of the box.

```shell
$ cd /usr/src
$ git clone https://github.com/nxp-qoriq/linux.git
$ cd linux
$ git checkout lf-6.6.3-1.0.0
$ make defconfig lsdk.config
```

Because this tutorial is focused on DPDK and VPP, which makes all the network interfaces bypass the kernel, the result is the device having no ethernet access initially. This means we cannot mount NFS when booting. In order to get around it, edit the file `arch/arm64/boot/dts/freescale/fsl-ls1046a-rdb-usdpaa.dts` and remove the block that starts with `ethernet@2` (line 42). This will result in the device tree passing the NIC back to the kernel, so it has at least one interface it will then use to mount the NFS. The particular one we're removing from the device tree file corresponds to RGMII-1 interface on the LS1046A Reference Design board, so we'll have to make sure that u-boot is using it when booting the kernel (we'll get there later on).

Once you removed the block from the device tree, recompile the kernel, which should be instantaneous since it only needs to recompile the device tree and not all the sources.

`$ make CROSS_COMPILE=aarch64-linux-gnu- -j8`

With this done, let's first set up a TFTP server so that we can always grab a fresh copy of the kernel and the device trees once we start booting our development board.


## (Optional) Set up a TFTP server

Since we already installed a TFTP server as part of the prerequisite packages, Debian likely already created a `/srv/tftp` directory, which we now have to modify slighly, and while we're at it, also make sure that it starts automatically whenever the machine is booted up:

```shell
$ systemctl enable tftpd-hpa
$ chown -R nobody:nogroup /srv/tftp
$ chmod -R 777 /srv/tftp
```

Now we can copy kernel and device trees into TFTP directory:

```shell
$ cd /usr/src/linux
$ cp arch/arm64/boot/Image* /srv/tftp
$ cp arch/arm64/boot/dts/freescale/fsl-ls1046a-rdb*.dtb /srv/tftp
```

If we check the contents of the TFTP directory, there are 6 device trees in that we can use for booting, but in this article, we're only interested in `fsl-ls1046a-rdb-usdpaa.dtb`. This particular one prevents kernel from using them for networking and instead passes them on to user space, hence the *US* in *USDPAA*. Because we modified the source file earlier, the kernel will only have access to **one** interface, while the rest will be *invisible* to it, from a networking standpoint.

If we wanted to develop the software which doesn't rely on DPDK (more on that soon), then we could use another device tree to boot our board with, such as `fsl-ls1046a-rdb-sdk.dtb`.


## (Optional) Make an SDCard image and NFS mount

This step is optional, but since the reference design board comes with an SD card slot that we can boot from, we can also prepare an image file and then mount it into `/mnt/rootfs` so that once we're done, we can directly use this image file to flash an SD card. 

```shell
$ cd /usr/src
$ qemu-img create sdcard.img 8G
$ parted --script sdcard.img \
    mktable gpt \
    mkpart primary ext4 1M 500M \
    mkpart primary ext4 500M 100% \
    set 1 boot on
$ losetup --show -f sdcard.img
$ kpartx -a /dev/loop0
$ mkfs.ext4 /dev/mapper/loop0p1
$ mkfs.ext4 /dev/mapper/loop0p2
$ mkdir /mnt/rootfs
$ mount /dev/mapper/loop0p2 /mnt/rootfs
$ mkdir /mnt/rootfs/boot
$ mount /dev/mapper/loop0p1 /mnt/rootfs/boot
```

Next, let's also expose the directories we just made as NFS mounts and reload the NFS server so that our board can boot into it - we'll get to how towards the end of the article.

```shell
$ echo "/mnt/rootfs 10.0.0.0/24(rw,sync,no_subtree_check,no_root_squash)" >> /etc/exports
$ exportfs -a
$ /etc/init.d/nfs-kernel-server reload
```


## Build a root filesystem

Okay, now we have everything prepared to build our initial filesystem which will run on the board, and for that, we'll use a package, called `debootstrap`. As the name suggests, it *bootstraps* a Debian filesystem into a directory of our choosing which will be `/mnt/rootfs` in our case.


```shell
$ debootstrap --arch=arm64 --foreign bookworm /mnt/rootfs
$ chroot /mnt/rootfs bash
$ /debootstrap/debootstrap --second-stage
$ apt install -y sudo openssh-server udev systemd-timesyncd python3-setuptools libxml2-dev libtclap-dev libfm-dev libfdt-dev libbpf-dev libpcap-dev libjansson-dev libbsd-dev libarchive-dev libxdp-dev libmbedtls-dev libnl-3-dev libdaq-dev
$ passwd
$ exit
```

Notice how we also installed a bunch of packages? Since we're *chrooted* into the target root filesystem, these packages provide all the necessary headers and libraries that are already compiled for arm64 - and our cross compiler will include those when needed.

---

Now that we have our filesystem set up, let's first copy all the kernel modules into it. This is an optional step, but can't hurt to have all the compiled modules in place, should we need them further on.

```shell
$ cd /usr/src/linux
$ INSTALL_MOD_PATH=/mnt/rootfs make modules_install
```

## Build FMlib and FMC

NXP LS1046A CPU comes with a special networking networking block, called DPAA (Data Path Accelleration Architecture). In Linux, this block is managed by a piece of software, called FMC or frame manager configurator. And for it to function, it depends on a library called `FMlib`. Let's build both.

```shell
$ cd /usr/src
$ git clone https://github.com/nxp-qoriq/fmlib.git
$ cd fmlib
$ git checkout lf-6.6.3-1.0.0
$ KERNEL_SRC="/usr/src/linux" \
  make all -j8
$ DESTDIR=/mnt/rootfs PREFIX=/usr make install-libfm-arm
```

The last command puts header files into `/mnt/rootfs/usr/include/fmd`, but just to make sure, run `find / -name "libfm-arm.a"` to verify that a file `/mnt/rootfs/usr/lib/libfm-arm.a` is indeed present.

Now that we have the *Frame manager* library and headers in place, we also need to take care of a dependecies that *Frame manager configurator* needs to build successfully.We'll go to the root filesystem (into `/usr/lib` directory), and add a couple of symlinks:

```shell
$ cd /mnt/rootfs/usr/lib
$ ln -sfr ./aarch64-linux-gnu/crti.o crti.o
$ ln -sfr ./aarch64-linux-gnu/crt1.o crt1.o
$ ln -sfr ./aarch64-linux-gnu/crtn.o crtn.o
```

And now that we have everything in place, we can build FMC:

```shell
$ cd /usr/src/
$ git clone https://github.com/nxp-qoriq/fmc.git
$ cd fmc
$ git checkout lf-6.6.3-1.0.0
$ make -C source clean && \
  CC="aarch64-linux-gnu-gcc --sysroot=/mnt/rootfs" \
  CXX="aarch64-linux-gnu-g++ --sysroot=/mnt/rootfs" \
  LDFLAGS="-Wl,-rpath-link=/mnt/rootfs/usr/lib/aarch64-linux-gnu \
    -L/mnt/rootfs/usr/lib \
    -L/mnt/rootfs/usr/lib/aarch64-linux-gnu" \
  CFLAGS="-Wno-write-strings -fpermissive \
    -I/mnt/rootfs/usr/include/aarch64-linux-gnu \
    -I/usr/src/fmlib/include/fmd \
    -I/usr/src/fmlib/include/fmd/Peripherals \
    -I/usr/src/fmlib/include/fmd/integrations" \
  make -C source \
    FMD_USPACE_HEADER_PATH=/usr/src/linux/include/uapi/linux/fmd \
    FMD_USPACE_LIB_PATH=/mnt/rootfs/usr/lib \
    LIBXML2_HEADER_PATH=/mnt/rootfs/usr/include/libxml2 \
    TCLAP_HEADER_PATH=/mnt/rootfs/usr/include
```

That's a long command, but that's just because we're cross compiling, and we need to make sure that correct tools and locations are taken into consideration by cross compiler!

With FMC built, let's now install it and all its support files into our target root filesystem:

```shell
$ install -m 755 source/fmc /mnt/rootfs/usr/local/bin/fmc && \
  install -d /mnt/rootfs/etc/fmc/config && \
  install -m 644 etc/fmc/config/cfgdata.xsd /mnt/rootfs/etc/fmc/config && \
  install -m 644 etc/fmc/config/hxs_pdl_v3.xml /mnt/rootfs/etc/fmc/config && \
  install -m 644 etc/fmc/config/netpcd.xsd /mnt/rootfs/etc/fmc/config && \
  install -d /mnt/rootfs/usr/local/include/fmc && \
  install source/fmc.h /mnt/rootfs/usr/local/include/fmc && \
  install source/libfmc.a /mnt/rootfs/lib/aarch64-linux-gnu
```

While the source comes with a serice file for systemd as well as a file that service needs to call, they are developed for multiple boards and as such, include checks we don't need. Let's instead make our own:

- `/mnt/rootfs/usr/local/bin/init-fmc.sh` with [this content](../files/development-set-up/init-fmc.sh) (don't forget to `chmod +x` on it!)
- `/mnt/rootfs/lib/systemd/system/fmc.service` with [this](../files/development-set-up/fmc.service)

Before you can use either DPDK or VPP, make sure to activate *fmc* at system boot, by running `$ systemctl enable fmc.service` inside the chroot target environment (`$ chroot /mnt/rootfs bash`) or on the board directly, so that the service will run at boot time.

## Build crypto packages

All ARM cpus come with dedicated cryptographic hardware, and to be able to utilize it, we need some some software which ARM already provides on their GitHub page.

```shell
$ cd /usr/src
$ git clone https://github.com/ARM-software/AArch64cryptolib
$ cd AArch64cryptolib
$ CROSS=aarch64-linux-gnu- OPT=big make all
$ install -m 644 libAArch64crypto.a /mnt/rootfs/usr/lib
$ install -m 644 AArch64cryptolib.h /mnt/rootfs/usr/include
```

> [!NOTE]
> You'll notice this will become a recurring theme going forward, so if you're unfamiliar with how compiling in linux works, just know that we need two main *ingredients*: libraries and headers. Libraries can either be statically linked and end with `.a` (archive) or dynamically linked shared objects, the names of which end with `.so` (shared object). And headers provide function declarations and their arguments and end up with `.h`


With `AArch64cryptolib` installed, let's also create a `.pc` file inside the target rootfs which is used by cross compiler to locate both the static library (the `libAArch64crypto.a` file which we just built) as well as the headers. 

```shell
$ tee -a /mnt/rootfs/usr/lib/aarch64-linux-gnu/pkgconfig/libAArch64crypto.pc << 'END'
prefix=/usr
exec_prefix=${prefix}
libdir=${prefix}/lib
includedir=${prefix}/include

Name: libAArch64crypto
Description: AArch64 Crypto Library
URL: https://github.com/ARM-software/AArch64cryptolib
Version: 23.03
Libs: -L${libdir} -lAArch64crypto
Cflags: -DPERF_GCM_BIG -I${includedir}
END
```

Next, as part of the *crypto* functionality, we also need to compile OpenSSL for the target, and we can reuse the one with built for the host earlier, so let's go back, clean the temporary files, then rebuild and reinstall it for the target:

```shell
$ cd /usr/src/openssl
$ make distclean
$ ./Configure linux-aarch64 --cross-compile-prefix=aarch64-linux-gnu- -Wl,-rpath=-L/mnt/rootfs/usr/lib/aarch64-linux-gnu -L/mnt/rootfs/usr/local/lib shared
$ make -j8
$ make DESTDIR=/mnt/rootfs install
```


## Build DPDK

Much like with the frame manager and kernel, we need to use a DPDK version that NXP provides because this software interacts with the DPAA hardware *directly* so NXP has done their *magic* on it to make sure that it does.

```shell
$ cd /usr/src
$ git clone https://github.com/nxp-qoriq/dpdk.git
$ cd dpdk
$ git checkout lf-6.6.36-2.1.0
```

Because DPDK uses `pkgconfig`, in order to find the dependencies it wants to use and build itself with, we have to prevent it from looking for those packages on the host machine and instead tell it to look in the target filesystem. The following command creates a file that solves this problem and said file is a fairly simple one, we just export the necessary paths (that are all on the target) and then call `pkgconfig` to look into those paths instead:

```shell
$ tee -a /usr/bin/aarch64-linux-gnu-pkg-config << 'END'
#!/bin/sh -e
SYSROOT=/mnt/rootfs
export PKG_CONFIG_PATH=${SYSROOT}/usr/lib/pkgconfig:${SYSROOT}/usr/local/lib/pkgconfig:${SYSROOT}/usr/lib/aarch64-linux-gnu/pkgconfig
export PKG_CONFIG_SYSROOT_DIR=${SYSROOT}
exec pkg-config "$@"
END
$ chmod +x /usr/bin/aarch64-linux-gnu-pkg-config
```

Now this file that we just created (`/usr/bin/aarch64-linux-gnu-pkg-config`) doesn't have any kind of *default* name, meaning we will have to tell the compilers and tools to use it going forward, and the very next code block will reflect that.

Since DPDK uses [Meson](https://mesonbuild.com/) to build itself, we also need to configure a *cross file* that it can refer to for building the code for another architecture. We're putting this file into out `/srv/src` so that keep the source of the project completely clean (also notice the `pkgconfig` line). 

```shell
$ tee -a ../dpdk.config << 'END'
[binaries]
c = ['aarch64-linux-gnu-gcc', '--sysroot=/mnt/rootfs']
cpp = ['aarch64-linux-gnu-g++', '--sysroot=/mnt/rootfs']
ar = 'aarch64-linux-gnu-ar'
as = 'aarch64-linux-gnu-as'
ld = ['aarch64-linux-gnu-ld', '--sysroot=/mnt/rootfs']
strip = 'aarch64-linux-gnu-strip'
pkgconfig = '/usr/bin/aarch64-linux-gnu-pkg-config'
pcap-config = ''

[host_machine]
system = 'linux'
cpu_family = 'aarch64'
cpu = 'armv8-a'
endian = 'little'

[properties]
platform = 'dpaa'
END
```

> [!NOTE]
> We've intentionally put this file *outside* the repository, because caching can sometime mess things up and it's easier to just delete the `dpdk` directory and start over, rather than mess around looking for those caches!


Let's now build DPDK:

```shell
$ rm -rf build-aarch64 && \
  meson setup build-aarch64 \
  --prefix=/usr \
  --buildtype=release \
  --default-library=shared \
  --cross-file=../dpdk.config \
  -Dkernel_dir=/usr/src/linux \
  -Dexamples=all \
  -Dmax_lcores=4 \
  -Dc_args="-g -Ofast -fPIC -ftls-model=local-dynamic -Wno-error=implicit-function-declaration \
    -I/mnt/rootfs/usr/include \
    -I/mnt/rootfs/usr/include/aarch64-linux-gnu" \
  -Dc_link_args="-Wl,-rpath-link=/mnt/rootfs/usr/lib/aarch64-linux-gnu \
    -L/mnt/rootfs/usr/lib/aarch64-linux-gnu \
    -L/mnt/rootfs/usr/lib \
    -L/mnt/rootfs/usr/local/lib"
```

If you followed the progress line by line so far, you should see the build report saying `Build targets in project: 698`. However even if the number is different, it just means that Meson didn't find all the dependencies in the target filesystem, so you can `chroot` back into it and add them if you want, and then re-run the above command. Once you're done, we can now build the sources and install them into place with the following:

```shell
$ DESTDIR=/mnt/rootfs ninja -C build-aarch64 install

$ rsync -a nxp/ /mnt/rootfs/usr/local/dpdk
$ install -m 644 ./drivers/bus/pci/bus_pci_driver.h /mnt/rootfs/usr/include
$ find ./build-aarch64/examples/ -type f -name "dpdk-*" -type f -exec sh -c "install -m 755 {} /mnt/rootfs/usr/local/bin/" \;
```

Now before we continue, we need to first fix one of the files, but only because we chose to pass one NIC to the kernel. Go to `/mnt/rootfs/usr/local/dpdk/dpaa/usdpaa_config_ls1046.xml` and delete the MAC port with number 3 (line 53). This will prevent DPDK from using this port because that would create a conflict with the kernel and thus result in errors!

You can now go to the board (or flash the SD card), boot it, and test DPDK by running `dpdk-helloworld`.

## Build VPP

Same as with DPDK, we'll use NXP's version:

```shell
$ cd /usr/src
$ git clone https://github.com/nxp-qoriq/vpp.git
$ cd vpp
$ git checkout lf-6.6.36-2.1.0
$ ln -s /mnt/rootfs/usr/lib/python3.11/_sysconfigdata__aarch64-linux-gnu.py \
   /usr/lib/python3.11/_sysconfigdata__aarch64-linux-gnu.py
```

Unfortunately, this version comes with a Meson *toolchain* file that isn't very friendly towards cross compilation, so we'll instead use our own. Just edit the `toolchain.cmake`, remove everything inside and put the contents of [this file](../files/development-set-up/toolchain.cmake) in. Now we can build it:

```shell
$ cd build-root
$ CROSS_SYSROOT=/mnt/rootfs \
  CROSS_PREFIX=aarch64-linux-gnu \
  DPDK_SRC=/usr/src/dpdk \
  DEB_BUILD_OPTIONS="nostrip" \
  LD_LIBRARY_PATH=/mnt/rootfs/usr/lib:/mnt/rootfs/lib/aarch64-linux-gnu \
  make V=0 PLATFORM=dpaa TAG=dpaa vpp-package-deb
```

When done (this might take a while), copy the resulting `*.deb` files into the target root filesystem:

```shell
$ mkdir /mnt/rootfs/usr/local/vpp
$ cp -vf *.deb /mnt/rootfs/usr/local/vpp
```

---

### Post-install stuff

At this point, we're all done with cross compilation and we have everything to boot into the target board and start testing. Feel free to either flash an SD card with the `sdcard.img` file we created earlier or boot into the board with NFS because we have everything we need, but before we load the kernel, we have to set some boot arguments.

In u-boot, run the following commands:

```shell
=> setenv dev "setenv bootargs console=ttyS0,115200 earlycon=uart8250,mmio,0x21c0500 root=/dev/nfs ip=dhcp nfsroot=10.0.0.90:/mnt/rootfs,vers=4,tcp rw rootwait default_hugepagesz=2m hugepagesz=2m hugepages=1024 isolcpus=2-3 rcu_nocbs=2-3 nohz_full=2-3 bportals=s0 qportals=s0 iommu.passthrough=1; tftp 0x81000000 Image; tftp 0x90000000 fsl-ls1046a-rdb-usdpaa.dtb; booti 0x81000000 - 0x90000000"
=> saveenv
=> run dev
```

Once you're booted into the operating system, go to where we just copied the files and install them:

```shell
$ cd /usr/local/vpp
$ dpkg -i *.deb
```

There's one last thing we need to do before we're done with the installation. VPP depends on the FMC to correctly set up the interfaces which is why it needs to start *after* FMC does, and to do that, we need to modify the file `/usr/lib/systemd/system/vpp.service` (on the target system) and change the `[Unit]` section, so that it has these two lines in it (remove the existing `After` line):

```ini
[Unit]
After=fmc.service
Requires=fmc.service
```

And while you're in, also remove the `ExecStartPre` line, and once done, exit the editor and make sure the service is enabled by running `$ systemctl enable vpp.service`.

> [!NOTE]
> In case you see an error that says `Your device tree is out of date, please update it.`, just ignore it, the PHY chip will work just fine.


We're almost there, the final thing we also need to do is mount something called *hugepages*. By default, Linux OS stores data in chunks, called *pages*, which are only 4 kb in size, but for high speed networking, these pages are too small which is why we passed the `default_hugepagesz=2m hugepagesz=2m hugepages=1024` earlier in u-boot. These *hugepages* are now allocated, but can't be accessed without mounting them first, so let's create a directory into which they will be mounted, and add a corresponding *fstab* entry do that linux does it automatically when booting:

```shell
$ mkdir /mnt/hugepages
$ echo "none /mnt/hugepages hugetlbfs defaults,pagesize=2M 0 0" > /etc/fstab
$ mount -a
```

All that we need to do now is restart the board and once it boots, enter `$ vppctl` to start using VPP!

---

#### References

- [NXP SDK 24.06 documentation](https://www.nxp.com/docs/en/user-guide/UG10143.pdf)
- [Vector Packet Processing](https://fd.io/)
- [Data Plane Development kit](https://www.dpdk.org/)
- [Flexbuild SDK for VPP](https://github.com/NXP/flexbuild/blob/main/src/apps/networking/vpp.mk)
- [OpenSSL sources](https://github.com/openssl/openssl)
- [Arm crypto lib](https://github.com/ARM-software/AArch64cryptolib)
- [Linaro cross compilation toolkit](https://snapshots.linaro.org/gnu-toolchain/12.3-2023.06-1/aarch64-linux-gnu/)
