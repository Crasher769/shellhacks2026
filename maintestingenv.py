from backend import *

print('Type "HELP" for a list of commands')
while True:
    command = input(f"Check: ").upper()

    if command == "HELP":
        print('''
        Available commands:
        Email
        Password
        Phone
        Address
        Name
        Quit
        ''')

    elif command == "EMAIL":
        email_breach()

    elif command == "PASSWORD":
        pass_breach()

    elif command == "QUIT":
        print("Exiting Program...")
        exit()

    else:
        print("Invalid command")
