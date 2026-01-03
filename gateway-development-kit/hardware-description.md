# Development Kit Hardware

This page describes the hardware specifications and functionality of the expansion ports and how to use them.

## Performance specification
|                            |                                                                                               |
|----------------------------|-----------------------------------------------------------------------------------------------|
| CPU                        | NXP Layerscape LS1046A<br>4 cores<br>1.6 GHz                                                  |
| RAM                        | 8 GB<br>2100 MT/s<br>ECC support                                                              |
| Networking                 | 2x SFP+ 10 Gb<br>3x RJ-45 1 Gb                                                                |
| Wifi                       | 1x M.2 Key-E port for Wifi 6.0 2x2 MU-MIMO<br>1x M.2 Key-E port for tri-radio (Wifi 5.0, Bluetooth, Thread)                         |
| Storage                    | 32 GB eMMC for Operating System<br>64 MB NOR flash for Bootloader                             |
| Debugging                  | JTAG connector<br>100+ test points throughout the PCB<br>UART USB-C port<br>Status RGB LED    |
| Required Power supply      | USB-C PD 3.0<br>15V 3A (45W) or<br>20V 2A (40W)                                               |
| Connectivity               | 1x USB-C 3.1 port<br>5Gbps data speed<br>5V 3A output power                                   |
| Active cooling support     | Yes<br>2x 4-pin PWM 5V fan headers                                                            |



## PCB mechanical properties

<img 
  src="assets/development-kit-pcb-dimensions.png" 
  alt="Development Kit PCB dimensions - mm [in]" 
  style="max-width:100%; display:block; margin:0 auto;"
/>

PCB thickness is 1.6mm [63 mil]

## Development Kit enclosure
Here you can download the 3D step models of the Development Kit enclosure (top and bottom part).  
{% file src="assets/10G_GW_DK_ENC_A1.zip" %}
    Enclosure 3D step models.
{% endfile %}


## Disassembly instructions
Since the expansion features are not accessible with the enclosure installed, it is mandatory to remove the printed circuit board (PCB) from the enclosure.

Before disassembling the device, ensure that proper ESD safety precautions are followed to prevent damage to the electronics.


### PCB removal guide
#### Required tools
Torx T10 screwdriver

<img 
  src="assets/development-kit-assembly-instruction-cover.png" 
  alt="Development Kit disassembly instructions - cover" 
  style="max-width:100%; display:block; margin:0 auto;"
/>

<img 
  src="assets/development-kit-assembly-instruction-pcb.png" 
  alt="Development Kit disassembly instructions - PCB" 
  style="max-width:100%; display:block; margin:0 auto;"
/>


#### Steps

- Power off the device and disconnect all cables.

- Place the device on a clean, flat, and ESD-safe surface.

- Using a Torx T10 screwdriver, remove the four screws securing the top cover of the enclosure.

- Carefully lift and remove the top cover.

- Using the same Torx T10 screwdriver, remove the five screws that secure the PCB to the enclosure.

- Gently lift the PCB out of the enclosure, holding it by the edges only.

#### ESD safety notes

- Work on an ESD-safe surface whenever possible.

- Wear a grounded ESD wrist strap, or regularly touch a grounded metal object to discharge static electricity.

- Avoid touching components, connectors, or exposed contacts on the PCB.

- Store the PCB in an ESD-safe bag when it is not installed in the enclosure.  

## Port description

<img 
  src="assets/development-kit-pcb-port-description-top.png" 
  alt="Development Kit PCB port description - TOP side" 
  style="max-width:100%; display:block; margin:0 auto;"
/>

<img 
  src="assets/development-kit-pcb-port-description-bot.png" 
  alt="Development Kit PCB port description - BOTTOM side" 
  style="max-width:100%; display:block; margin:0 auto;"
/>


### GPIO_1 
The GPIO header can be found on the top side of the board and has 1.27mm pin pitch. 

![GPIO port pinout](assets/development-kit-gpio-port.png)


### Connector type
| Connector type     | Description                  | Link                                                   |
|--------------------|------------------------------|--------------------------------------------------------|
| PCB connector      | Wurth Elektronik 62701420621, 14-pin, 1.27mm  | [Datasheet](assets/62701420621.pdf)   |
| Cable connector    | Wurth Elektronik 62701423121, 14-pin, 1.27mm  | [Datasheet](assets/62701423121.pdf)   |

### Pinout 
A GPIO pin configured as an output pin can be set to high (1.8V) or low (0V).  
A GPIO pin configured as an input pin can be read as high (1.8V) or low (0V). This is made easier with the use of internal pull-up or pull-down resistors. This can be configured in software.

| Pin #      | Name                             | Specification                                      |
|------------|----------------------------------|----------------------------------------------------|
| 1          | PWR OUT 1.8V                     | Power output, 1.8V, 100mA max. Resettable fuse.    |
| 2          | PWR OUT 3.3V                     | Power output, 3.3V, 100mA max. Resettable fuse.    |
| 3          | I2C SDA                          | I2C BUS DATA. 1.8V logic level.                    |
| 5          | I2C SCL                          | I2C BUS CLOCK. 1.8V logic level.                   |
| 4          | GPIO_D1                          | GPIO pin #1                                        |
| 6          | GPIO_D2                          | GPIO pin #2                                        |
| 9          | GPIO_D3                          | GPIO pin #3                                        |
| 10         | GPIO_D4                          | GPIO pin #4                                        |
| 11         | GPIO_D5                          | GPIO pin #5                                        |
| 12         | GPIO_D6                          | GPIO pin #6                                        |
| 7-8, 13-14 | GND                              | Ground                                             |


### Voltage specifications

| INPUT                     |                  |
|---------------------------|------------------|
| Absolute maximum rating   | 1.98 V           |
| Input high voltage        | >1.26 V          |
| Input low voltage         | <0.36 V          |
| Input current             | +-50 uA          |

| OUTPUT                    |                  |
|---------------------------|------------------|
| Output high voltage       | 1.35 V @ -0.5 mA |
| Output low voltage        | 0.4 V @ 0.5 mA   |
| Maximum current           | +-0.5 mA         |




{% hint style="danger" %}
**WARNING** GPIO data pins are not protected. Do not overstress them. Doing so will damage the CPU.
{% endhint %}

All other ports are described in the [getting started](getting-started.md)

