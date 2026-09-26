from xposedornot import XposedOrNot

def email_breach(): #Uses XposedOrNot to check for Email breaches
    xon = XposedOrNot()
    email = input("Email:")

    # Check email for breaches
    result = xon.check_email(email)
    print(result)
    if result == True:
        print('''
        Do this now;
        1. Change your passwords
        2. Enable two-factor authentication (2FA)
        ''')
#This uses XposedOrNot's open community API. https://xposedornot.com/api_doc https://xposedornot.com/


def pass_breach(): #Uses XposedOrNot to check for Email breaches
    xon = XposedOrNot()
    password = input("Password:")

    # Check email for breaches
    result = xon.check_password(password)
    print(result)
    if result == True:
        print('''
        Do this now;
        1. Change your passwords
        2. Enable two-factor authentication (2FA)
        ''')