# Build a Debian Linux image from scratch

In order to build a Debian linux from scratch for an embedded device, we need three components:

- Linux Kernel
- Root filesystem (along with an optional initial RAM filesystem)
- A device tree

If you encounter any issues following this tutorial, you're likely missing dependencies like `build-essential` on your system. I'm using Debian (bookworm) virtual machine on the M1 Mac Studio for everything below which means I don't have to use cross compilation tools, but if you're working on an x86 machine, give [this document](https://bootlin.com/doc/training/embedded-linux/embedded-linux-labs.pdf) a read.

## Build the kernel

Let's first create a directory in which we will perform all the work then download and uncompress the kernel into it. We will be using the mainline kernel version 6.6.51 for this tutorial, but you're encouraged to check whether the manufacturer of your particular board supplies their own kernel and use that instead.

```
$ mkdir embedded-debian
$ cd embedded-debian
$ wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.6.51.tar.xz
$ tar -xf linux-6.6.51.tar.xz
$ cd linux-6.6.51
```

For the purpose of making it simple, we won't do any modifications to the kernel configuration, but if you do, you can always run `$ make menuconfig` and play around with the settings. Run the following to create a `.config` file from the default one (you can find these files in `linux-6.6.51/arch/arm64/configs`):

```
$ make defconfig
$ make -j8 # Replace 8 with the number of cores you have available on your machine
$ cd ..
```

After this is done (it can take a while depending on how much cores and RAM you have), we next need to build the initial RAM filesystem or *initramfs*.

## Build the *initramfs*

Let's use [Busybox](https://www.busybox.net/) for this purpose because once fully built the whole filesystem only takes up a couple of megabytes:

```
$ wget https://github.com/mirror/busybox/archive/refs/tags/1_36_0.tar.gz
$ tar -zxf 1_36_0.tar.gz
$ cd busybox-1_36_0
```

Before we build it, it's recommended to build all files as one static binary, so go into *menuconfig* by entering `$ make menuconfig` and then check **Settings --> Build static binary (no shared libs)**.

This is all we have to do in here, but feel free to look around at all the options and packages you can build into the final image and add anything you might seem necessary. Once you're done, save and exit the configuration and run:

```
$ make -j8
$ make install
$ cd ..
```

This created a directory `_install` which holds almost everything we need for our final *initramfs*, but we're missing two things - an *init* script which kernel needs to run as the very first thing once it's done booting, and a couple of directories that it also expects, so let's make both:

```
$ mkdir initramfs
$ mkdir -p initramfs/bin initramfs/sbin initramfs/etc initramfs/proc initramfs/sys initramfs/dev initramfs/usr/bin initramfs/usr/sbin
$ cat > ./initramfs/init << EOF
#!/bin/sh

mount -t proc none /proc
mount -t sysfs none /sys

cat <<!

  _    _ _     __  __                   _ 
 | |  | (_)   |  \/  |                 | |
 | |__| |_    | \  / | ___  _ __   ___ | |
 |  __  | |   | |\/| |/ _ \| '_ \ / _ \| |
 | |  | | |_  | |  | | (_) | | | | (_) |_|
 |_|  |_|_( ) |_|  |_|\___/|_| |_|\___/(_)
          |/                              

Booting kernel took $(cut -d' ' -f1 /proc/uptime) seconds.

!
exec /bin/sh
EOF
$ chmod +x initramfs/init
```

Our *initramfs* is now complete, so lets compress it into a CPIO image:

```
$ chmod +x initramfs/init
$ ls -al initramfs
$ cd initramfs
$ find . -print0 | cpio --null -ov --format=newc | gzip -9 > ../initramfs.cpio.gz
$ cd ..
$ mkimage -A arm64 -O linux -T ramdisk -C gzip -d initramfs.cpio.gz initramfs.cpio.gz.uboot
```

Notice the last line/command? We need it in order to make it compatible with u-boot. If you plan to **only** use it within a *FIT image*, then this step is not necessary. However, for the sake of completeness, we will do both, boot a FIT image and a regular u-boot `booti` boot, so let's now make a directory on our [TFTP server](https://www.baeldung.com/linux/tftp-server-install-configure-test) and copy all the files we'll need into it:

```
$ mkdir -p /srv/tftp/embedded-debian
$ cp linux-6.6.51/arch/arm64/boot/Image* /srv/tftp/youtube
$ cp linux-6.6.51/arch/arm64/boot/dts/freescale/fsl-ls1046a-rdb.dtb /srv/tftp/youtube
$ cp initramfs.cpio.gz* /srv/tftp/youtube
```

Notice how I'm also copying over the `fsl-ls1046a-rdb.dtb` over? This file is particular to the board I'm working on and was automatically built by the kernel. If you're using your own board, make sure to change this to whatever the documentation that came with your board says.

## Make a FIT image

Next, let's create a FIT image *recipe* file, and make sure to put it into `/srv/tftp/embedded-debian/board.its` with the following contents:

```
/dts-v1/;

/ {
    description = "LS1046A-RDB FIT Image";
    #address-cells = <1>;

    images {
        kernel {
            description = "ARM64 Kernel";
            data = /incbin/("Image.gz");
            type = "kernel";
            arch = "arm64";
            os = "linux";
            compression = "gzip";
            load = <0x84080000>;
            entry = <0x84080000>;
        };
        fdt {
            description = "DTB";
            data = /incbin/("fsl-ls1046a-rdb.dtb");
            type = "flat_dt";
            arch = "arm64";
            compression = "none";
            load = <0x90000000>;
        };
        initrd {
            description = "Initrd";
            data = /incbin/("initramfs.cpio.gz");
            type = "ramdisk";
            arch = "arm64";
            os = "linux";
            compression = "gzip";
        };
    };

    configurations {
        default = "standard";
        standard {
            description = "Standard Boot";
            kernel = "kernel";
            fdt = "fdt";
            ramdisk = "initrd";
        };
    };
};
```

Here, you can change all the description fields to your heart's content, but pay close attention to the filenames (all the `data` fields) - they need to match the names of the files you've built and copied into this directory. And finally, `load` and `entry` fields, especially for the kernel, need to be positioned correctly. This should come with the documentation for the CPU, but if you're unsure check what u-boot configuration for your board uses - use whatever the `$kernel_addr_r` environment variable is set to - just enter `printenv $kernel_addr_r` in u-boot.

Now let's build the FIT image:

```
$ mkimage -f /srv/tftp/embedded-debian/board.its /srv/tftp/embedded-debian/board.itb
```

To test it out, now go u-boot on your board and enter the following (make sure to change IP addresses for both your board and the TFTP server):

```
=> setenv ipaddr 10.0.0.10
=> setenv serverip 10.0.0.1
=> setenv bootargs "console=ttyS0,115200 root=/dev/ram0 rootwait rw net.ifnames=0 earlycon=uart8250,mmio,0x21c0500"
=> tftp 0x80000000 embedded-debian/board.itb
=> bootm 0x80000000
```

This will unpack the FIT image and if everything is in order, start the kernel and get you into the *initramfs* image we built earlier.

## Build a *proper* Debian distribution

Because the above will only get you into a really basic filesystem that can't do much and is not permanent, it's now time to set up a proper Debian image that we can flash an SD card with. Make sure to `cd embedded-debian` where we will make an empty image by using tools that [qemu-img](https://qemu-project.gitlab.io/qemu/tools/qemu-img.html) brings to the table:

```
$ qemu-img create sdcard.img 4G
$ sudo parted --script sdcard.img \
    mktable gpt \
    mkpart primary ext4 1M 500M \
    mkpart primary ext4 500M 100% \
    set 1 boot on
```

We've created a 4 GB image file then inside of it, created the two partitions we'll need: first, a boot partition, which will hold our kernel, device trees and the initial RAM filesystem, and second, our root filesystem partition which'll hold the whole Debian root filesystem. However, this is still just a file, so run the following commands:

```
$ sudo losetup --show -f sdcard.img
$ sudo kpartx -a /dev/loop0
$ sudo mkfs.ext4 /dev/mapper/loop0p1
$ sudo mkfs.ext4 /dev/mapper/loop0p2
$ sudo mkdir /mnt/sdcard
$ sudo mkdir /mnt/sdcard/boot
$ sudo mount /dev/mapper/loop0p2 /mnt/sdcard
$ sudo mount /dev/mapper/loop0p1 /mnt/sdcard/boot
```

Let's go over what we just did:

- we turned our SD card image file into a loopback device (a fake drive, if you will)
- since it has paritions, we use `kpartx` to expose them in `/dev/mapper/loop0pX` (X being partition number)
- then we turn the exposed partitions into `ext4` filesystems
- and finally, we create mountpoints for the partitions into which we also mount them

If you check both directories, so `/mnt/sdcard` and `/mnd/sdcard/boot`, you'll notice there is only one directory in each of them (`lost+found` which is an artifact of `ext4` filesystem), so let's now install Debian into the second partition:

```
$ sudo apt install debootstrap
$ sudo debootstrap --arch=arm64 --foreign bookworm /mnt/sdcard
$ sudo chroot /mnt/sdcard bash
$ /debootstrap/debootstrap --second-stage
$ apt install -y sudo ifupdown net-tools wget ntpdate openssh-server iperf3
$ passwd
$ exit
```

*Debootstrap*, as the name suggests, is a utility which installs a Debian base system into whichever directory you want it to, and in our case, we install it directly into the sdcard image which we have mounted earlier. But this is only half of the equation, the files are just copied, but not *installed*, which is why we need to `chroot` into the image and run the *second stage* which does that.

And while we're in, we also install some basic stuff that we'll need, the most important being network and time management. If you need other tools, feel free to install them here.

And last thing, we also need to set up the root password, otherwise we won't be able to log in once we boot into this image.

### Install Kernel

We now have our root filesystem in place, so we need to install Kernel into the `/boot` partition on the SD card image. Go back to the `embedded-debian` directory and run the following:

```
$ cd linux-6.6.51
$ sudo INSTALL_MOD_PATH=/mnt/sdcard make modules_install
$ sudo INSTALL_PATH=/mnt/sdcard/boot make install
$ sudo mkdir /mnt/sdcard/boot/dtb
$ sudo cp arch/arm64/boot/dts/freescale/fsl-ls1046a-rdb*.dtb /mnt/sdcard/boot/dtb
```

This'll install both the kernel itself **and** all the separate modules that were built along with the kernels. The kernel will get installed into our boot partition while the modules go into our root filesystem (into `/lib/modules/`). And while we're at it, we also create a `dtb` directory on our boot partition where we will put our device trees. This directory is optional and you're free to name it whatever you like - or even skip it completely, if your board boots with device tree being elsewhere.

The final thing we need to copy over into our boot partition is optional if you don't intend to use it, but it's good to have it in place as a sort of a rescue system and that's the initramfs image we built earlier, and while we're at it also copy the FIT image, which we will likely not need, but doesn't hurt to have it available:

```
$ sudo cp initramfs.cpio.gz* /mnt/sdcard/boot
$ sudo cp /srv/tftp/embedded-debian/board.itb /mnt/sdcard/boot
```

There we go, we now have everything in place to flash our SD card. Take the `sdcard.img` file that we've been working on this whole time and use the program [Balena Etcher](https://etcher.balena.io/) to write it to the SD card. Keep in mind that this image **IS NOT directly bootable** as it doesn't have any bootloaders. In my case, u-boot already comes with the board, but your mileage may vary.

## Clean up

Once you're done building the image, use the following commands to unmount the partitions and detatch the loopback device with the commands below, however, feel free to skip this step in case you discover in any of the next steps that your image doesn't boot correctly (or at all) and you need to make any adjustments.

```
$ sudo umount /dev/mapper/loop0p1
$ sudo umount /dev/mapper/loop0p2
$ sudo kpartx -d /dev/loop0
$ sudo losetup -d /dev/loop0
```

## Boot into our Debian

Once in u-boot, run the following commands:

```
=> setenv bootargs "console=ttyS0,115200 root=/dev/mmcblk0p2 rootwait rw net.ifnames=0 earlycon=uart8250,mmio,0x21c0500"
=> load mmc 0:1 $kernel_addr_r vmlinuz-6.6.51
=> load mmc 0:1 $fdt_addr_r dtb/fsl-ls1046a-rdb.dtb
=> booti $kernel_addr_r - $fdt_addr_r
```

While the commands should be pretty self-explanatory, let's go over them real quick:

- We set the kernel boot arguments to now look at the *second* partition for the root filesystem. This is because our first partition on the device is the `/boot` partition that holds our kernel and the device tree.
- We load both, the kernel and the device tree into RAM
- We boot the board. Notice the minus in `booti` command? That's because we're skipping the initial RAM filesystem.

This should hopefully get you to the login screen, but we're not quite done yet. If you check the `/boot` directory, you'll notice that it's empty. This is perfectly fine if you never intend to use it from within Linux, but for the sake of completeness, let's make sure its automatically mounted at boot. First check the *UUID* of your partitions, by running `$ ls -la /dev/disk/by-uuid/` and copy the UUID of the partition that points to `mmcblk0p1` (remember, our first partition is the boot partition).

Then open `/etc/fstab` file with your favorite editor and paste the following line into it, and make sure you change the UUID to whatever *your* UUID of the partition is:

```
/dev/disk/by-uuid/9df01dc0-039c-4efe-8b14-e594704d51a5 /boot ext4 defaults 0 2
```

Then commit the above by entering `$ mount -a`. The `/etc/fstab` file gets read at boot which means Debian will automatically mount this partition every time.

## Tips and tricks

If you ever need to boot into **initramfs** for whatever reason, run the following:
```
=> setenv bootargs "console=ttyS0,115200 root=/dev/ram0 rootwait rw net.ifnames=0 earlycon=uart8250,mmio,0x21c0500"
=> load mmc 0:1 $kernel_addr_r vmlinuz-6.6.51
=> load mmc 0:1 $ramdisk_addr_r initramfs.cpio.gz.uboot
=> load mmc 0:1 $fdt_addr_r dtb/fsl-ls1046a-rdb.dtb
=> booti $kernel_addr_r $ramdisk_addr_r $fdt_addr_r
```

{% hint style="info" %}
Pay special attention to the `root=/dev/ram0` part of the `bootargs` environment variable because this tells kernel as to where to look for the root filesystem. Since we're using *initramfs*, it needs to look into RAM. But if we skip *initramfs*, then it needs to look into our *mmc* device, which is why we used `root=/dev/mmcblk0p2` earlier.
{% endhint %}

Once you're done with it, continue booting into Debian with the following:

```
$ mkdir -p /mnt/root
$ mount -o rw /dev/mmcblk0p2 /mnt/root
$ mount -o rw /dev/mmcblk0p1 /mnt/root/boot
$ umount /proc
$ umount /sys
$ exec switch_root /mnt/root /sbin/init
```

Gentoo has some [great documentation](https://wiki.gentoo.org/wiki/Custom_Initramfs#Init) about this topic, so go and give it a read!

---

#### References
- [Build a kernel, initramfs and Busybox to create your own micro-Linux](https://cylab.be/blog/320/build-a-kernel-initramfs-and-busybox-to-create-your-own-micro-linux)
- [Complete tutorial to create a Debian Minimal RootFS](https://akhileshmoghe.github.io/_post/linux/debian_minimal_rootfs)
- [Ramfs, rootfs and initramfs](https://docs.kernel.org/filesystems/ramfs-rootfs-initramfs.html)
- [Busybox](https://busybox.net/)
- [Debootstrap](https://wiki.debian.org/Debootstrap)
- [qemu-img](https://qemu-project.gitlab.io/qemu/tools/qemu-img.html)
- [Bootlin Embedded Linux Labs](https://bootlin.com/doc/training/embedded-linux/embedded-linux-labs.pdf)
- [Installing and Configuring a TFTP Server on Linux](https://bootlin.com/doc/training/embedded-linux/embedded-linux-labs.pdf)
