# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - heading "Spetaar" [level=1] [ref=e6]
    - paragraph [ref=e7]: Healthcare Management
  - generic [ref=e9]:
    - heading "Staff Login" [level=2] [ref=e10]
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]: Email address
        - textbox "Email address" [ref=e14]
      - generic [ref=e15]:
        - generic [ref=e16]: Password
        - generic [ref=e17]:
          - textbox "Password" [ref=e18]
          - button [ref=e19] [cursor=pointer]:
            - img [ref=e20]
      - generic [ref=e23]:
        - generic [ref=e24]:
          - checkbox "Remember me" [ref=e25]
          - generic [ref=e26]: Remember me
        - link "Forgot password?" [ref=e27] [cursor=pointer]:
          - /url: /forgot-password
      - button "Sign in" [ref=e28] [cursor=pointer]
```