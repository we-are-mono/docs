# Restoring OpenWRT

To follow this how-to, user will need USB key with around 300MB free space, formatted to Linux ext2/3/4 partition.
**Warning: these actions will delete all your settings and configurations you might have stored on the device.**

To restore the OpenWRT after other operating systems were deployed, follow these steps:

1. Connect the power cable and the UART cable to your computer. (Power is left most, UART is right most)
2. Open a serial terminal:
   ```
   tio /dev/ttyUSB0
   ```
   (Adjust the device path if needed—check `ls /dev/ttyUSB*` to find yours.)
3. Reboot the device
4. Interrupt the startup process by pressing `Enter` key during the 5 second wait perion
5. Check the environment variable to make sure the boot process is set correctly
   1. Issue command `env print bootcmd`
   2. The output should look like `bootcmd=run emmc || run recovery`
   3. If it does not match, run command to backup the current boot command `setenv bootcmd_bak ${bootcmd}`
   4. Set the boot command by running `setenv bootcmd "run opnsense || run recovery"`
   5. Save the environment variables by running `saveenv`
6. Erase the mmc storage by running command `mmc erase 0 3b48000`
7. Issue command ` => run recovery `
8. Once in recovery, login as user `root`

# Restoring partitions
Other operating systems might have modified the partition layout, we need to restore it.
1. Start partition management by command `fdisk /dev/mmcblk0`
2. Use command `p` to show the list of current partitions
3. There should be only one partition and the output should be similar to this:
```
root@recovery:~# fdisk /dev/mmcblk0

Welcome to fdisk (util-linux 2.40.4).
Changes will remain in memory only, until you decide to write them.
Be careful before using the write command.


Command (m for help): p
Disk /dev/mmcblk0: 29.64 GiB, 31826378752 bytes, 62160896 sectors
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disklabel type: dos
Disk identifier: 0xc885790c

Device         Boot Start      End  Sectors  Size Id Type
/dev/mmcblk0p1       2048 62160895 62158848 29.6G 83 Linux

Command (m for help):
```
4. If the output looks like above (only 1 partition `/dev/mmcblk0p1`, and partition type `Linux`), you can skip the rest of this part
5. If there is different partition layout, do the following:
   1. use command `o` to create new DOS partition (this will erase all existing partitions)
   2. use command `n` to create new partition
   3. use command `p` to create primary partition
   4. use value `1` to create first partition
   5. accept the starting block by pressing `Enter`
   6. accept the ending block by pressing `Enter`
   7. use command `p` to verify the partition layout is now as expected (see Restoring partitions step 3)
   8. use command `w` to write changes to the disk
Now the partition is created correctly and the system is ready for flashing the partition image.

# Flashing the OpenWRT image
1. Download the OpenWRT release image from https://mono.si/openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-rootfs.ext4.gz.
2. Copy the file `openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-rootfs.ext4.gz` to your USB key
3. Insert the USB key to the middle USB-C port on the device
4. Mount the storage using command `mount /dev/sda1 /media`
5. Flash the device using `gunzip -c openwrt-layerscape-armv8_64b-mono_gateway-dk-ext4-rootfs.ext4.gz | dd of=/dev/mmcblk0p1 bs=1M`
6. Reboot the device

The device should boot directly to OpenWRT, all settings will be erased and device is ready for initial configuration.
