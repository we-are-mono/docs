---
title: "Restoring device tree"
section: "Gateway development kit"
order: 6
---

When user does not follow the steps for upgrading OpenWRT, it can happen the bootloader data will get overwritten.
This how-to should help the user to get the router to correct bootable state.

## Part 1: Problem description

During flashing of OpenWRT, user can by mistake use incorrect parameters for the **dd** command, overwriting the bootloader.
The startup process will fail, u-boot will stop with following output:
```
Retrieving file: /boot/extlinux/extlinux.conf
** No partition table - mmc 0 **
Couldn't find partition mmc 0:1
Error reading config file
SF: Detected mt25qu512abb with page size 256 Bytes, erase size 64 KiB, total 64 MiB
device 0 offset 0xa00000, size 0x1600000
SF: 23068672 bytes @ 0xa00000 Read: OK
device 0 offset 0x500000, size 0x100000
SF: 1048576 bytes @ 0x500000 Read: OK
   Uncompressing Kernel Image to 0
ERROR: Did not find a cmdline Flattened Device Tree
Could not find a valid device tree
```
Command `run recovery` will result in similar problem:
```
=> run recovery
SF: Detected mt25qu512abb with page size 256 Bytes, erase size 64 KiB, total 64 MiB
device 0 offset 0xa00000, size 0x1600000
SF: 23068672 bytes @ 0xa00000 Read: OK
device 0 offset 0x500000, size 0x100000
SF: 1048576 bytes @ 0x500000 Read: OK
   Uncompressing Kernel Image to 0
ERROR: Did not find a cmdline Flattened Device Tree
Could not find a valid device tree
```


### 1. Prepare TFTP server

To get the necessary data to your gateway, you need to have TFTP server available on the same network as your router.
Good guide to set the server up on Ubuntu can be found [here](https://linuxvox.com/blog/linux-tftp-server-ubuntu/).

### 2. Gaining the device MAC address

To get the binary file, you will need to access the mono firmware website. The site requires authentication. The username is **mono**, but the password is your MAC address of the device.
To gain the MAC address, connect to the gateway's serial port.
On your PC, start a serial console (e.g. on Ubuntu, run terminal command tio /dev/ttyUSB0).
Now start the gateway (or reset the device).
As it is bricked, u-boot will anyhow not be able to start, so you can just wait until you will be dropped back to the u-boot shell.
Once the prompt is available (you will see just `=>` in your serial terminal window) type command `pri`.
This will print out all environment variables. Scroll up and find the variable `ethaddr`. The line will look like
```
ethaddr=E8:F6:D7:xx:xx:xx
```
Copy the value (starting with E8 in the above example) **including the colons** - this will be used as a password to download the file.

### 3. Downloading the firmware file

On your Ubuntu workstation, issue command
```
curl -fS -u "mono:[MAC]" \
  -o firmware-emmc-gateway-dk.bin \
  "https://firmware.mono.si/firmware-emmc-gateway-dk.bin"
```
Replace the [MAC] with the value from [step 2](#2-Gaining-the-device-MAC-address).
Copy the file to your TFTP server root directory - if you used the how-to from [step 1](#1-Prepare-TFTP-server), this will be /srv/tftp.
You can use command such as `sudo cp firmware-emmc-gateway-dk.bin /srv/tftp`.

### 4. Setting up IP address

In order to proceed, you will need following information:
- your TFTP server IP address
- your default IP gateway
- one free IP address on the same network as the TFTP server

If you used your own computer to install TFTP as documented in [step 1](#1-Prepare-TFTP-server), you can use following command:
`ip route show default` - this command will print output such as
`default via 10.100.10.254 dev enp11s0 proto dhcp src 10.100.10.54 metric 100`. In this example, the computer IP address is 10.10.10.54 and default IP gateway is 10.100.10.254.
In this example, the IP address 10.100.10.19 will be used as the IP address for mono gateway device.

### 5. Setting the env and running the tftpboot

In your serial console, issue following commands:
```
=> setenv ipaddr "10.100.10.19"
=> setenv gatewayip "10.100.10.254"
=> setenv serverip "10.100.10.254"
=> setenv ethact "fm1-mac2"
=> setenv ethprime "fm1-mac2"
=> saveenv
```
**Replace the IP addresses above with values from [step 4](#4-Setting-up-IP-address).**

The environment will be saved to SPIFlash memory.
You can verify the correct values again by running command `pri` and searching for ipaddr, gatewayip, serverip and ethact.

Once the environment values are present, issue a serial console command
```
tftpboot ${loadaddr} firmware-emmc-gateway-dk.bin
```
This will start the network interface. Don't worry if you get timeout, the device will switch to the next available interface. It will then download the file from your TFTP server.
It should result in status message
```
done
Bytes transferred = 33554432 (2000000 hex)
```

### 6. Writing the file to MMC

We need to set final environment variables. In the serial console, type commands:
```
setexpr src ${loadaddr} + 0x1000
setexpr cnt ${filesize} - 0x1000
setexpr cnt ${cnt} / 0x200
mmc dev 0
```
The output of the last one should be 
```
switch to partitions #0, OK
mmc0(part 0) is current device
```

Now we can write the content to the MMC using command
```
mmc write ${src} 0x8 ${cnt}
```

### 7. Switching to eMMC

Locate a DIP switch on the PCB with labels "eMMC" and "NOR". Flip the switch to **eMMC**.
Reboot or power-cycle the board - you should now be able to reach recovery.


### 8. Recovery steps

Once in recovery, login as `root` with no password.
Now you can obtain correct DHCP IP address and update the firmware.
In this example, the network cable is plugged to port eth1 (the left-most port on the device).
Obtaining DHCP IP address:
```
udhcpc -i eth1
```
Now to update the firmware, run:
```
firmware update --preserve-env
```
You will need to type `yes` to confirm the flashing process.

This process will take some time and you should **NOT** interrupt it.
The process will erase, write and verify the blocks.

Once done, the process will finish with message
```
:: Firmware update complete. Reboot to use the new firmware.
```

Do not reboot, yet, you need to also flash OpenWRT image.

### 9. Flashing the OpenWRT

Download latest OpenWRT build from [mono openwrt site](https://openwrt.mono.si).
In this example, it will be build [r1787707074](https://openwrt.mono.si/mono-v25.12.5-r1787707074/layerscape-armv8_64b-mono_gateway-dk-ext4-emmc.img.gz).
To do this, in the mono gateway recovery console run commands:
```
wget https://openwrt.mono.si/mono-v25.12.5-r1787707074/layerscape-armv8_64b-mono_gateway-dk-ext4-emmc.img.gz
gunzip layerscape-armv8_64b-mono_gateway-dk-ext4-emmc.img.gz
DEV=/dev/mmcblk0
IMG=layerscape-armv8_64b-mono_gateway-dk-ext4-emmc.img
dd if=$IMG of=$DEV bs=512 count=8
dd if=$IMG of=$DEV bs=1M skip=32 seek=32
```

### 9. NOR reboot

After the firmware update and writing the OpenWRT image, you will need to flip the switch from **eMMC** back to **NOR** and reboot the device by running command `reboot` in mono gateway serial console.

**Stop the boot process by pressing any key when you see countdown, such as `Hit any key to stop autoboot:  4`.

This will stop the boot process and allow again to set environment variables:
```
setenv bootcount 1
setenv bootlimit 3
setenv openwrt 'setenv bootargs "${bootargs_console} boot_medium=emmc root=/dev/mmcblk0p2 rootwait"; run emmc_load && booti ${kernel_addr_r} - ${fdt_addr_r}'
setenv bootcmd 'run openwrt || run recovery'
saveenv
```
Now we are done.

Disconnect the network cable and issue command `boot` to start OpenWRT.
