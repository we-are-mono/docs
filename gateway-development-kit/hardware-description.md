# Development Kit Hardware

This page describes the hardware specifications and functionality of the expansion ports and how to use them.

## PCB mechanical properties

## Disassembly instructions
Since the expansion features are not accessible with the enclosure installed, it is mandatory to remove the printed circuit board (PCB) from the enclosure.

Before disassembling the device, ensure that proper ESD safety precautions are followed to prevent damage to the electronics.

### Required tools

Torx T10 screwdriver

### Instructions

![Development Kit disassembly instructions - cover](assets/development-kit-assembly-instruction-cover.png)
![Development Kit disassembly instructions - PCB](assets/development-kit-assembly-instruction-pcb.png)

### Steps

- Power off the device and disconnect all cables.

- Place the device on a clean, flat, and ESD-safe surface.

- Using a Torx T10 screwdriver, remove the four screws securing the top cover of the enclosure.

- Carefully lift and remove the top cover.

- Using the same Torx T10 screwdriver, remove the five screws that secure the PCB to the enclosure.

- Gently lift the PCB out of the enclosure, holding it by the edges only.

### ESD safety notes

- Work on an ESD-safe surface whenever possible.

- Wear a grounded ESD wrist strap, or regularly touch a grounded metal object to discharge static electricity.

- Avoid touching components, connectors, or exposed contacts on the PCB.

- Store the PCB in an ESD-safe bag when it is not installed in the enclosure.  

## Port description


![Development Kit PCB port description - TOP side](assets\development-kit-pcb-port-description-top.png)
![Development Kit PCB port description - BOTTOM side](assets\development-kit-pcb-port-description-bot.png)

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
**WARNING** > GPIO data pins are not protected. Do not overstress them. Overstressing them will result into damaging the CPU.
{% endhint %}

All other ports are described in the [getting started](getting-started.md)

