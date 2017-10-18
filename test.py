def test():
    t = 1

    def inner():
        nonlocal t
        t = t + 1
        print(t)

    inner()
    
test()